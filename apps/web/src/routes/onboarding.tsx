import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  Briefcase,
  CircleFadingPlus,
  CircleGauge,
  FileSearch2,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  ListTodo,
  type LucideIcon,
  Megaphone,
  MessageCircleQuestion,
  Search,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { requireSession } from "@/lib/auth-guard";
import { looksLikePhone } from "@/lib/display-name";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingComponent,
  beforeLoad: async () => {
    const { session } = await requireSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
});

type AccountType = "individual" | "legal";

// Подписи вариантов живут в i18n (onboarding.*); в БД уходит `value`.
interface IconOption {
  value: string;
  icon: LucideIcon;
}

const GOALS_INDIVIDUAL: IconOption[] = [
  { value: "study", icon: GraduationCap },
  { value: "work", icon: Briefcase },
  { value: "personal", icon: ListTodo },
];

const GOALS_LEGAL: IconOption[] = [
  { value: "management", icon: CircleGauge },
  { value: "team_templates", icon: LayoutDashboard },
  { value: "find_contracts", icon: FileSearch2 },
  { value: "consulting", icon: MessageCircleQuestion },
];

// Теги и индустрии исторически сохраняются в БД русской подписью — `value`
// оставляем как есть, а `key` ведёт к переводу подписи.
interface TagOption {
  value: string;
  key: string;
}

const LEGALS_TAGS: TagOption[] = [
  { value: "Аренда", key: "rent" },
  { value: "Услуги", key: "services" },
  { value: "Трудовые", key: "employment" },
  { value: "Купля и продажа", key: "sale" },
  { value: "Займ", key: "loan" },
  { value: "NDA", key: "nda" },
  { value: "Другое", key: "other" },
];

const OUTREACH_OPTIONS: IconOption[] = [
  { value: "google", icon: Search },
  { value: "ai", icon: Sparkles },
  { value: "ads", icon: Megaphone },
  { value: "social", icon: CircleFadingPlus },
  { value: "referral", icon: Handshake },
];

const INDUSTRIES: TagOption[] = [
  { value: "IT и технологии", key: "it" },
  { value: "Финансы и банкинг", key: "finance" },
  { value: "Недвижимость", key: "realty" },
  { value: "Строительство", key: "construction" },
  { value: "Розничная торговля", key: "retail" },
  { value: "Услуги", key: "services" },
  { value: "Производство", key: "manufacturing" },
  { value: "Образование", key: "education" },
  { value: "Медицина", key: "medicine" },
  { value: "Транспорт и логистика", key: "logistics" },
  { value: "Другое", key: "other" },
];

function OnboardingComponent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session } = Route.useRouteContext();
  const accountType =
    ((session?.user as { accountType?: string } | undefined)?.accountType as
      | AccountType
      | undefined) ?? "individual";

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const signupStatusQuery = useQuery(trpc.auth.signupStatus.queryOptions());
  const statusQuery = useQuery(trpc.onboarding.status.queryOptions());
  const saveMutation = useMutation(trpc.onboarding.save.mutationOptions());
  const completeMutation = useMutation(
    trpc.onboarding.complete.mutationOptions()
  );

  // Регистрация не дозавершена (нет пароля / юр.лицо без орг) — на хаб.
  useEffect(() => {
    const s = signupStatusQuery.data;
    if (!s) {
      return;
    }
    const needsPassword = !s.hasPassword;
    const needsOrg = s.accountType === "legal" && !s.hasOrganization;
    if (needsPassword || needsOrg) {
      navigate({ to: "/continue-signup" });
    }
  }, [signupStatusQuery.data, navigate]);

  const [step, setStep] = useState(1);
  const [goals, setGoals] = useState<string[]>([]);
  const [legals, setLegals] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [outreach, setOutreach] = useState<string>("");
  const [policyAccepted, setPolicyAccepted] = useState(false);

  const ensureOrganizationAndGo = useCallback(async () => {
    const { data: orgs } = await authClient.organization.list();
    if (!orgs || orgs.length === 0) {
      // Phone-only signups have user.name = the raw phone; don't name the org
      // after it. Fall back to a generic workspace name (and a safe slug base).
      const rawName = session?.user.name;
      const orgName =
        rawName && !looksLikePhone(rawName)
          ? rawName
          : t("onboarding.defaultOrgName");
      const slugBase =
        orgName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "org";
      const result = await authClient.organization.create({
        name: orgName,
        slug: `${slugBase}-${Date.now()}`,
      });
      if (result.error) {
        toast.error(result.error.message || t("onboarding.errorOrg"));
        return;
      }
    }
    navigate({ to: "/dashboard" });
  }, [navigate, session?.user.name, t]);

  // Гидратация из БД срабатывает один раз при первом получении статуса.
  const hydratedRef = useRef(false);
  useEffect(() => {
    const data = statusQuery.data;
    if (!data || hydratedRef.current) {
      return;
    }
    hydratedRef.current = true;
    if (data.completedAt) {
      ensureOrganizationAndGo();
      return;
    }
    setGoals(data.goals ?? []);
    setLegals(data.legals ?? []);
    setIndustries(data.industries ?? []);
    setOutreach(data.outreach ?? "");
  }, [statusQuery.data, ensureOrganizationAndGo]);

  const totalSteps = 4;

  async function persist(partial: Parameters<typeof saveMutation.mutate>[0]) {
    try {
      await saveMutation.mutateAsync(partial);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("onboarding.errorSave")
      );
    }
  }

  async function handleFinish() {
    try {
      await completeMutation.mutateAsync({ acceptedPolicy: true });
      // Гейт requireAuth и хаб /continue-signup читают эти запросы из кеша —
      // сбрасываем, чтобы не отправили обратно в онбординг.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: trpc.auth.signupStatus.queryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.onboarding.status.queryKey(),
        }),
      ]);
      toast.success(t("onboarding.welcome"));
      await ensureOrganizationAndGo();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("onboarding.errorFinish")
      );
    }
  }

  if (statusQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <p className="text-muted-foreground text-sm">
          {t("onboarding.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted px-4 py-8 sm:px-6 sm:py-12">
      <main className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl sm:p-8">
        <StepHeader current={step} total={totalSteps} />

        {step === 1 && accountType === "individual" && (
          <StepGoals
            multi={false}
            onNext={async (next) => {
              setGoals(next);
              await persist({ goals: next });
              setStep(2);
            }}
            onSkip={() => setStep(2)}
            options={GOALS_INDIVIDUAL}
            selected={goals}
            subtitle={t("onboarding.goalsSubtitle")}
            title={t("onboarding.goalsTitle")}
          />
        )}
        {step === 1 && accountType === "legal" && (
          <StepIndustries
            onNext={async (next) => {
              setIndustries(next);
              await persist({ industries: next });
              setStep(2);
            }}
            selected={industries}
          />
        )}

        {step === 2 && accountType === "individual" && (
          <StepLegals
            onBack={() => setStep(1)}
            onNext={async (next) => {
              setLegals(next);
              await persist({ legals: next });
              setStep(3);
            }}
            onSkip={() => setStep(3)}
            selected={legals}
          />
        )}
        {step === 2 && accountType === "legal" && (
          <StepGoals
            multi
            onNext={async (next) => {
              setGoals(next);
              await persist({ goals: next });
              setStep(3);
            }}
            options={GOALS_LEGAL}
            selected={goals}
            subtitle={t("onboarding.goalsSubtitle")}
            title={t("onboarding.goalsTitle")}
          />
        )}

        {step === 3 && (
          <StepOutreach
            onBack={() => setStep(2)}
            onNext={async (next) => {
              setOutreach(next);
              await persist({ outreach: next });
              setStep(4);
            }}
            selected={outreach}
          />
        )}

        {step === 4 && (
          <StepPolicy
            accepted={policyAccepted}
            isSubmitting={completeMutation.isPending}
            onAcceptedChange={setPolicyAccepted}
            onBack={() => setStep(3)}
            onNext={handleFinish}
          />
        )}
      </main>
    </div>
  );
}

function StepHeader({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  const pct = Math.round((current / total) * 100);
  return (
    <div className="mb-6 flex flex-col gap-3">
      {/* Переключатель языка — единственный способ сменить язык на этом
          экране, у него нет сайдбара и шапки сайта. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <span />
        <p className="text-center text-foreground/80 text-sm">
          {t("onboarding.step", { current, total })}
        </p>
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 flex flex-col items-center gap-2 text-center">
      <h1 className="font-medium text-2xl text-foreground sm:text-3xl">
        {title}
      </h1>
      <p className="text-base text-foreground/80">{subtitle}</p>
    </div>
  );
}

function MenuOption({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
        selected
          ? "bg-muted text-foreground"
          : "text-foreground hover:bg-muted/60"
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{label}</span>
    </button>
  );
}

function StepGoals({
  multi,
  onNext,
  onSkip,
  options,
  selected,
  subtitle,
  title,
}: {
  multi: boolean;
  onNext: (next: string[]) => void;
  onSkip?: () => void;
  options: IconOption[];
  selected: string[];
  subtitle: string;
  title: string;
}) {
  const { t } = useTranslation();
  const [local, setLocal] = useState<string[]>(selected);

  function toggle(value: string) {
    if (multi) {
      setLocal((prev) =>
        prev.includes(value)
          ? prev.filter((v) => v !== value)
          : [...prev, value]
      );
    } else {
      setLocal([value]);
    }
  }

  return (
    <>
      <Heading subtitle={subtitle} title={title} />
      <div className="mb-6 flex flex-col gap-1">
        {options.map((o) => (
          <MenuOption
            icon={o.icon}
            key={o.value}
            label={t(`onboarding.goals.${o.value}`)}
            onClick={() => toggle(o.value)}
            selected={local.includes(o.value)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Button
          className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
          disabled={local.length === 0}
          onClick={() => onNext(local)}
          type="button"
        >
          {t("onboarding.continue")}
        </Button>
        {onSkip && (
          <Button
            className="h-10 w-full rounded-lg text-foreground/70 text-sm hover:bg-transparent hover:text-foreground"
            onClick={onSkip}
            type="button"
            variant="ghost"
          >
            {t("onboarding.skip")}
          </Button>
        )}
      </div>
    </>
  );
}

function StepLegals({
  onBack,
  onNext,
  onSkip,
  selected,
}: {
  onBack: () => void;
  onNext: (next: string[]) => void;
  onSkip: () => void;
  selected: string[];
}) {
  const { t } = useTranslation();
  const [local, setLocal] = useState<string[]>(selected);

  function toggle(tag: string) {
    setLocal((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <>
      <Heading
        subtitle={t("onboarding.legalsSubtitle")}
        title={t("onboarding.legalsTitle")}
      />
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {LEGALS_TAGS.map((tag) => {
          const isOn = local.includes(tag.value);
          return (
            <button
              className={cn(
                "rounded-[10px] border px-2.5 py-1.5 text-sm transition-colors",
                isOn
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:border-foreground/40"
              )}
              key={tag.value}
              onClick={() => toggle(tag.value)}
              type="button"
            >
              {t(`onboarding.legals.${tag.key}`)}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        <Button
          className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
          disabled={local.length === 0}
          onClick={() => onNext(local)}
          type="button"
        >
          {t("onboarding.continue")}
        </Button>
        <Button
          className="h-10 w-full rounded-lg text-foreground/70 text-sm hover:bg-transparent hover:text-foreground"
          onClick={onSkip}
          type="button"
          variant="ghost"
        >
          {t("onboarding.skip")}
        </Button>
      </div>
      <button
        className="mt-3 w-full text-center text-muted-foreground text-xs hover:text-foreground"
        onClick={onBack}
        type="button"
      >
        {t("onboarding.back")}
      </button>
    </>
  );
}

function StepIndustries({
  onNext,
  selected,
}: {
  onNext: (next: string[]) => void;
  selected: string[];
}) {
  const { t } = useTranslation();
  const [local, setLocal] = useState<string[]>(selected);
  const primary = local[0] ?? "";

  function setPrimary(value: string) {
    setLocal((prev) => {
      // первый элемент — основная индустрия из dropdown.
      const rest = prev.slice(1).filter((v) => v !== value);
      return [value, ...rest];
    });
  }

  return (
    <>
      <Heading
        subtitle={t("onboarding.industriesSubtitle")}
        title={t("onboarding.industriesTitle")}
      />
      <div className="mb-6">
        <Select onValueChange={setPrimary} value={primary}>
          <SelectTrigger className="h-10 w-full rounded-lg text-sm">
            <SelectValue placeholder={t("onboarding.industriesPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {t(`onboarding.industries.${item.key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
        disabled={!primary}
        onClick={() => onNext(local)}
        type="button"
      >
        {t("onboarding.continue")}
      </Button>
    </>
  );
}

function StepOutreach({
  onBack,
  onNext,
  selected,
}: {
  onBack: () => void;
  onNext: (next: string) => void;
  selected: string;
}) {
  const { t } = useTranslation();
  const [local, setLocal] = useState<string>(selected);

  return (
    <>
      <Heading
        subtitle={t("onboarding.outreachSubtitle")}
        title={t("onboarding.outreachTitle")}
      />
      <div className="mb-6 flex flex-col gap-1">
        {OUTREACH_OPTIONS.map((o) => (
          <MenuOption
            icon={o.icon}
            key={o.value}
            label={t(`onboarding.outreach.${o.value}`)}
            onClick={() => setLocal(o.value)}
            selected={local === o.value}
          />
        ))}
      </div>
      <Button
        className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
        disabled={!local}
        onClick={() => onNext(local)}
        type="button"
      >
        {t("onboarding.continue")}
      </Button>
      <button
        className="mt-3 w-full text-center text-muted-foreground text-xs hover:text-foreground"
        onClick={onBack}
        type="button"
      >
        {t("onboarding.back")}
      </button>
    </>
  );
}

function StepPolicy({
  accepted,
  isSubmitting,
  onAcceptedChange,
  onBack,
  onNext,
}: {
  accepted: boolean;
  isSubmitting: boolean;
  onAcceptedChange: (v: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Heading
        subtitle={t("onboarding.policySubtitle")}
        title={t("onboarding.policyTitle")}
      />
      <div className="mb-6 flex items-start gap-3">
        <Checkbox
          checked={accepted}
          className="mt-0.5 size-4 rounded-sm border-border data-checked:border-foreground data-checked:bg-foreground data-checked:text-background"
          id="policy-accept"
          onCheckedChange={(c) => onAcceptedChange(c === true)}
        />
        <label
          className="flex-1 cursor-pointer text-foreground/80 text-sm"
          htmlFor="policy-accept"
        >
          {t("onboarding.policyPrefix")}
          <a className="underline" href="/terms">
            {t("onboarding.policyTerms")}
          </a>
          {t("onboarding.policyAnd")}
          <a className="underline" href="/privacy">
            {t("onboarding.policyPrivacy")}
          </a>
          {t("onboarding.policySuffix")}
        </label>
      </div>
      <Button
        className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
        disabled={!accepted || isSubmitting}
        onClick={onNext}
        type="button"
      >
        {isSubmitting ? t("onboarding.finishing") : t("onboarding.start")}
      </Button>
      <button
        className="mt-3 w-full text-center text-muted-foreground text-xs hover:text-foreground"
        onClick={onBack}
        type="button"
      >
        {t("onboarding.back")}
      </button>
    </>
  );
}
