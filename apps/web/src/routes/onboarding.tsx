import { useMutation, useQuery } from "@tanstack/react-query";
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
import { toast } from "sonner";

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

const GOALS_INDIVIDUAL: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "study", label: "Учёба", icon: GraduationCap },
  { value: "work", label: "Работа и подработка", icon: Briefcase },
  { value: "personal", label: "Личные дела", icon: ListTodo },
];

const GOALS_LEGAL: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "management", label: "Управление бизнесом", icon: CircleGauge },
  {
    value: "team_templates",
    label: "Шаблоны для команды",
    icon: LayoutDashboard,
  },
  { value: "find_contracts", label: "Поиск договоров", icon: FileSearch2 },
  {
    value: "consulting",
    label: "Юридические консультации",
    icon: MessageCircleQuestion,
  },
];

const LEGALS_TAGS = [
  "Аренда",
  "Услуги",
  "Трудовые",
  "Купля и продажа",
  "Займ",
  "NDA",
  "Другое",
];

const OUTREACH_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "google", label: "Поиск в интернете", icon: Search },
  { value: "ai", label: "AI / ChatGPT", icon: Sparkles },
  { value: "ads", label: "Реклама", icon: Megaphone },
  { value: "social", label: "Социальные сети", icon: CircleFadingPlus },
  { value: "referral", label: "Друзья / партнёры", icon: Handshake },
];

const INDUSTRIES = [
  "IT и технологии",
  "Финансы и банкинг",
  "Недвижимость",
  "Строительство",
  "Розничная торговля",
  "Услуги",
  "Производство",
  "Образование",
  "Медицина",
  "Транспорт и логистика",
  "Другое",
];

function OnboardingComponent() {
  const navigate = useNavigate();
  const { session } = Route.useRouteContext();
  const accountType =
    ((session?.user as { accountType?: string } | undefined)?.accountType as
      | AccountType
      | undefined) ?? "individual";

  const trpc = useTRPC();
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
        rawName && !looksLikePhone(rawName) ? rawName : "Мои документы";
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
        toast.error(result.error.message || "Не удалось создать организацию");
        return;
      }
    }
    navigate({ to: "/dashboard" });
  }, [navigate, session?.user.name]);

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
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    }
  }

  async function handleFinish() {
    try {
      await completeMutation.mutateAsync({ acceptedPolicy: true });
      toast.success("Добро пожаловать в Zhebe!");
      await ensureOrganizationAndGo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось завершить");
    }
  }

  if (statusQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <p className="text-muted-foreground text-sm">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-6 py-12">
      <main className="w-full max-w-md rounded-2xl bg-background p-8 shadow-xl">
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
            subtitle="Подберём договоры, которые подойдут именно вам"
            title="Как вы собираетесь использовать Zhebe?"
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
            subtitle="Подберём договоры, которые подойдут именно вам"
            title="Как вы собираетесь использовать Zhebe?"
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
  const pct = Math.round((current / total) * 100);
  return (
    <div className="mb-6 flex flex-col gap-3">
      <p className="text-center text-foreground/80 text-sm">
        Шаг {current} из {total}
      </p>
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
      <h1 className="font-medium text-3xl text-foreground">{title}</h1>
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
  options: { value: string; label: string; icon: LucideIcon }[];
  selected: string[];
  subtitle: string;
  title: string;
}) {
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
            label={o.label}
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
          Продолжить
        </Button>
        {onSkip && (
          <Button
            className="h-10 w-full rounded-lg text-foreground/70 text-sm hover:bg-transparent hover:text-foreground"
            onClick={onSkip}
            type="button"
            variant="ghost"
          >
            Пропустить
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
  const [local, setLocal] = useState<string[]>(selected);

  function toggle(tag: string) {
    setLocal((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <>
      <Heading
        subtitle="Выберите одну или несколько категорий"
        title="Какие договоры вам нужны чаще всего?"
      />
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {LEGALS_TAGS.map((tag) => {
          const isOn = local.includes(tag);
          return (
            <button
              className={cn(
                "rounded-[10px] border px-2.5 py-1.5 text-sm transition-colors",
                isOn
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:border-foreground/40"
              )}
              key={tag}
              onClick={() => toggle(tag)}
              type="button"
            >
              {tag}
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
          Продолжить
        </Button>
        <Button
          className="h-10 w-full rounded-lg text-foreground/70 text-sm hover:bg-transparent hover:text-foreground"
          onClick={onSkip}
          type="button"
          variant="ghost"
        >
          Пропустить
        </Button>
      </div>
      <button
        className="mt-3 w-full text-center text-muted-foreground text-xs hover:text-foreground"
        onClick={onBack}
        type="button"
      >
        Назад
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
        subtitle="Выберите до 3 вариантов — настроим каталог под вас"
        title="В какой сфере вы работаете?"
      />
      <div className="mb-6">
        <Select onValueChange={setPrimary} value={primary}>
          <SelectTrigger className="h-10 w-full rounded-lg text-sm">
            <SelectValue placeholder="Select an item" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
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
        Продолжить
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
  const [local, setLocal] = useState<string>(selected);

  return (
    <>
      <Heading
        subtitle="Это помогает нам понять, где нас ищут"
        title="Как вы узнали о Жебе?"
      />
      <div className="mb-6 flex flex-col gap-1">
        {OUTREACH_OPTIONS.map((o) => (
          <MenuOption
            icon={o.icon}
            key={o.value}
            label={o.label}
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
        Продолжить
      </Button>
      <button
        className="mt-3 w-full text-center text-muted-foreground text-xs hover:text-foreground"
        onClick={onBack}
        type="button"
      >
        Назад
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
  return (
    <>
      <Heading
        subtitle="Пожалуйста, ознакомьтесь с условиями использования платформы"
        title="Прежде чем начать"
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
          Я ознакомился и принимаю{" "}
          <a className="underline" href="/terms">
            условия использования
          </a>{" "}
          и{" "}
          <a className="underline" href="/privacy">
            политику конфиденциальности
          </a>
          .
        </label>
      </div>
      <Button
        className="h-10 w-full rounded-lg bg-foreground text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
        disabled={!accepted || isSubmitting}
        onClick={onNext}
        type="button"
      >
        {isSubmitting ? "Завершаем..." : "Приступить к работе"}
      </Button>
      <button
        className="mt-3 w-full text-center text-muted-foreground text-xs hover:text-foreground"
        onClick={onBack}
        type="button"
      >
        Назад
      </button>
    </>
  );
}
