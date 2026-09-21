import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { Check, Plus, Settings, User } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { ForgotPasswordDialog } from "@/components/forgot-password-dialog";
import { type DbPlan, PlansPicker } from "@/components/plans-picker";
import { SubscriptionManageDialog } from "@/components/subscription-manage-dialog";
import { TwoFactorDialog } from "@/components/two-factor-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VerifyContactDialog } from "@/components/verify-contact-dialog";
import { requireAuth } from "@/lib/auth-guard";
import { formatQuotaResetDate } from "@/lib/quota-period";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  validateSearch: (
    search: Record<string, unknown>
  ): { tab?: ProfileTab; subscribed?: boolean } => ({
    tab: PROFILE_TABS.find((t) => t.id === search.tab)?.id,
    subscribed:
      search.subscribed === true ||
      search.subscribed === "true" ||
      search.subscribed === "1",
  }),
  beforeLoad: async () => {
    const { session, organizations } = await requireAuth();
    return { session, organizations };
  },
});

type ProfileTab = "personal" | "security" | "requisites" | "subscription";

// id уходит в URL (?tab=…) — не переводим, подпись берём из словаря.
const PROFILE_TABS: { id: ProfileTab; labelKey: string }[] = [
  { id: "personal", labelKey: "profile.tabs.personal" },
  { id: "security", labelKey: "profile.tabs.security" },
  { id: "requisites", labelKey: "profile.tabs.requisites" },
  { id: "subscription", labelKey: "profile.tabs.subscription" },
];

// Карточки тарифов и переключатель периода живут в общем компоненте
// PlansPicker (используется и попапом «Тарифы» в модалках шаблона).

/** «21 сентября» / «21 қыркүйек» — день и месяц на языке интерфейса. */
function formatDayMonth(language: string, d: Date): string {
  const locale = language === "kk" ? "kk-KZ" : "ru-RU";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(d);
}

function formatPurchaseDate(language: string, value: Date | string): string {
  const d = new Date(value);
  return `${formatDayMonth(language, d)}, ${d.getFullYear()}`;
}

function statusMeta(
  t: TFunction,
  status: string
): { label: string; className: string } {
  if (status === "paid") {
    return {
      label: t("profile.subscription.history.status.paid"),
      className: "text-[#2e6b2e]",
    };
  }
  if (status === "expired") {
    return {
      label: t("profile.subscription.history.status.expired"),
      className: "text-destructive",
    };
  }
  if (status === "failed") {
    return {
      label: t("profile.subscription.history.status.failed"),
      className: "text-destructive",
    };
  }
  return {
    label: t("profile.subscription.history.status.pending"),
    className: "text-muted-foreground",
  };
}

function UsageCard({
  label,
  used,
  quota,
}: {
  label: string;
  used: number;
  quota: number;
}) {
  const unlimited = quota === -1;
  const pct = unlimited || quota <= 0 ? 0 : Math.min(100, (used / quota) * 100);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-foreground text-sm">{label}</span>
        <span className="text-muted-foreground text-sm">
          {used}/{unlimited ? "∞" : quota}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Подпись под названием тарифа. Автосписаний нет — честная формулировка
// «действует до», а не «следующее списание»; отменённая подписка живёт до
// конца оплаченного периода.
function subscriptionSubtitle(
  t: TFunction,
  language: string,
  my:
    | {
        isPaid: boolean;
        expiresAt: Date | string | null;
        cancelledAt: Date | string | null;
      }
    | undefined
): string {
  if (!my?.isPaid) {
    return t("profile.subscription.subtitle.free");
  }
  if (!my.expiresAt) {
    return t("profile.subscription.subtitle.unlimited");
  }
  if (my.cancelledAt) {
    return t("profile.subscription.subtitle.cancelled", {
      date: formatPurchaseDate(language, my.expiresAt),
    });
  }
  return t("profile.subscription.subtitle.activeUntil", {
    date: formatPurchaseDate(language, my.expiresAt),
  });
}

function SubscriptionTab({ justPaid }: { justPaid?: boolean }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [successOpen, setSuccessOpen] = useState(Boolean(justPaid));
  const [manageOpen, setManageOpen] = useState(false);
  const trpc = useTRPC();
  const { data: dbPlans = [] } = useQuery(
    trpc.subscriptions.plans.queryOptions()
  );
  const { data: my } = useQuery(
    trpc.subscriptions.mySubscription.queryOptions()
  );
  const { data: history = [] } = useQuery(
    trpc.payments.myHistory.queryOptions()
  );

  const typedPlans = dbPlans as DbPlan[];
  // Квота проверок — из колонки тарифа, а не из текста фичи «Проверка
  // документов»: гейт кнопки «На проверку юристу» считает по ней же, и при
  // расхождении профиль обещал бы проверки, которых сервер не даёт.
  const checksQuota = my?.reviewQuota ?? 0;

  const checkout = useMutation(
    trpc.payments.createSubscriptionCheckout.mutationOptions({
      onSuccess: (res) => {
        // Hand off to Robokassa; the ResultURL webhook activates the plan.
        window.location.href = res.url;
      },
      onError: (err) => {
        toast.error(err.message || t("profile.subscription.checkoutError"));
      },
    })
  );

  const expiresAtDate = my?.expiresAt ? new Date(my.expiresAt) : null;

  return (
    <section className="flex flex-col gap-6">
      {/* Current subscription */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-foreground text-lg leading-6">
            {my?.planName ?? t("profile.subscription.noPlan")}
          </h3>
          <p className="text-muted-foreground text-sm">
            {subscriptionSubtitle(t, i18n.language, my)}
          </p>
        </div>
        <Button
          className={OUTLINE_BTN}
          onClick={() => setManageOpen(true)}
          size="lg"
          type="button"
          variant="outline"
        >
          <Settings className="size-4" />
          {t("profile.subscription.manage")}
        </Button>
      </div>

      <SubscriptionManageDialog
        checksQuota={checksQuota}
        onOpenChange={setManageOpen}
        open={manageOpen}
      />

      {/* Usage — квоты месячные: окно идёт от даты активации подписки. */}
      {my && (
        <p className="text-muted-foreground text-sm">
          {t("profile.subscription.quotaReset", {
            date: formatQuotaResetDate(i18n.language, my.quotaResetAt),
          })}
        </p>
      )}
      {my && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <UsageCard
            label={t("profile.subscription.usage.downloads")}
            quota={my.downloadQuota}
            used={my.downloadsUsed}
          />
          <UsageCard
            label={t("profile.subscription.usage.edits")}
            quota={my.editQuota}
            used={my.editsUsed}
          />
          <UsageCard
            label={t("profile.subscription.usage.reviews")}
            quota={checksQuota}
            used={my.reviewsUsed}
          />
        </div>
      )}

      {/* Plans */}
      <PlansPicker
        currentPlanId={my?.planId ?? null}
        loadingPlanId={
          checkout.isPending ? (checkout.variables?.planId ?? null) : null
        }
        onSelectPlan={(planId, period) => checkout.mutate({ planId, period })}
        plans={typedPlans}
      />

      {/* Purchase history */}
      {history.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold text-2xl text-foreground leading-6">
            {t("profile.subscription.history.title")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <tbody>
                {history.map((item) => {
                  const meta = statusMeta(t, item.status);
                  const label =
                    item.description ||
                    (item.purpose === "subscription"
                      ? t("profile.subscription.history.subscription")
                      : t("profile.subscription.history.document"));
                  return (
                    <tr
                      className="border-border border-b last:border-b-0"
                      key={item.invId}
                    >
                      <td className="py-3 pr-4 text-foreground">{label}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatPurchaseDate(i18n.language, item.createdAt)}
                      </td>
                      <td className="py-3 pr-4 text-foreground">
                        {item.amount.toLocaleString("ru-RU")} ₸
                      </td>
                      <td className={cn("py-3 pr-4", meta.className)}>
                        {meta.label}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          className="text-foreground text-sm underline hover:no-underline"
                          onClick={() =>
                            toast.info(
                              t("profile.subscription.history.comingSoon")
                            )
                          }
                          type="button"
                        >
                          {item.status === "paid"
                            ? t("profile.subscription.history.receipt")
                            : t("profile.subscription.history.pay")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Success modal after a subscription payment */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSuccessOpen(false);
            navigate({ to: "/profile", search: { tab: "subscription" } });
          }
        }}
        open={successOpen && Boolean(my?.planName)}
      >
        <DialogContent className="sm:max-w-sm">
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-[#d6edd6]">
              <Check className="size-7 text-[#2e6b2e]" />
            </span>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-semibold text-foreground text-lg">
                {t("profile.subscription.success.title")}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("profile.subscription.success.activated", {
                  plan: my?.planName,
                })}
                {expiresAtDate &&
                  ` ${t("profile.subscription.success.activeUntil", {
                    date: formatDayMonth(i18n.language, expiresAtDate),
                    year: expiresAtDate.getFullYear(),
                  })}`}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

interface Requisite {
  id: string;
  name: string;
  type: string;
  inn: string;
  address: string;
  phone: string;
  email: string;
  bank: string;
  iban: string;
  bik: string;
  kbe: string;
  knp: string;
  signatory: string;
  position: string;
  basis: string;
}

type RequisiteDraft = Omit<Requisite, "id">;

const EMPTY_DRAFT: RequisiteDraft = {
  name: "",
  type: "ТОО",
  inn: "",
  address: "",
  phone: "",
  email: "",
  bank: "",
  iban: "",
  bik: "",
  kbe: "",
  knp: "",
  signatory: "",
  position: "",
  basis: "",
};

// Значение type хранится в БД как есть (русская аббревиатура) — переводим
// только подпись в селекте и бейдже.
const REQUISITE_TYPES: { value: string; labelKey: string }[] = [
  { value: "ТОО", labelKey: "profile.requisites.types.too" },
  { value: "ИП", labelKey: "profile.requisites.types.ip" },
  { value: "АО", labelKey: "profile.requisites.types.ao" },
  { value: "Физ. лицо", labelKey: "profile.requisites.types.individual" },
];

function requisiteTypeLabel(t: TFunction, type: string): string {
  const known = REQUISITE_TYPES.find((item) => item.value === type);
  return known ? t(known.labelKey) : type;
}

type RequisiteFieldKey = Exclude<keyof RequisiteDraft, "name" | "type">;

// Editable inputs in the dialog (name/type are rendered separately above them).
// Подпись поля — profile.requisites.fields.<key>.
const FORM_FIELDS: { key: RequisiteFieldKey; full?: boolean }[] = [
  { key: "inn" },
  { key: "address", full: true },
  { key: "phone" },
  { key: "email" },
  { key: "bank" },
  { key: "iban" },
  { key: "bik" },
  { key: "kbe" },
  { key: "knp" },
  { key: "signatory", full: true },
  { key: "position" },
  { key: "basis" },
];

const REQUISITE_FIELDS: RequisiteFieldKey[] = FORM_FIELDS.map(
  (field) => field.key
);

function RequisitesTab() {
  const { t } = useTranslation();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: requisites = [], isLoading } = useQuery(
    trpc.requisites.list.queryOptions()
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RequisiteDraft>(EMPTY_DRAFT);

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.requisites.list.queryFilter());

  const createMut = useMutation(
    trpc.requisites.create.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success(t("profile.requisites.added"));
        setDialogOpen(false);
      },
      onError: (err) => toast.error(err.message),
    })
  );
  const updateMut = useMutation(
    trpc.requisites.update.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success(t("profile.actions.saved"));
        setDialogOpen(false);
      },
      onError: (err) => toast.error(err.message),
    })
  );
  const deleteMut = useMutation(
    trpc.requisites.delete.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success(t("profile.requisites.deleted"));
        setDialogOpen(false);
      },
      onError: (err) => toast.error(err.message),
    })
  );
  const pending =
    createMut.isPending || updateMut.isPending || deleteMut.isPending;

  const setField = (key: keyof RequisiteDraft, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setDialogOpen(true);
  };
  const openEdit = (r: (typeof requisites)[number]) => {
    setDraft({
      name: r.name,
      type: r.type,
      inn: r.inn,
      address: r.address,
      phone: r.phone,
      email: r.email,
      bank: r.bank,
      iban: r.iban,
      bik: r.bik,
      kbe: r.kbe,
      knp: r.knp,
      signatory: r.signatory,
      position: r.position,
      basis: r.basis,
    });
    setEditingId(r.id);
    setDialogOpen(true);
  };
  const save = () => {
    if (!draft.name.trim()) {
      toast.error(t("profile.requisites.nameRequired"));
      return;
    }
    if (editingId) {
      updateMut.mutate({ id: editingId, ...draft });
    } else {
      createMut.mutate(draft);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      {isLoading && (
        <p className="py-10 text-center text-muted-foreground text-sm">
          {t("profile.requisites.loading")}
        </p>
      )}

      {!isLoading && requisites.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border border-dashed py-16">
          <p className="font-medium text-foreground text-sm">
            {t("profile.requisites.empty.title")}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            {t("profile.requisites.empty.hint")}
          </p>
        </div>
      )}

      {requisites.map((requisite) => (
        <div
          className="rounded-xl border border-border bg-card p-5"
          key={requisite.id}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h3 className="font-semibold text-foreground text-lg leading-6">
                {requisite.name}
              </h3>
              <span className="rounded-md bg-secondary/40 px-2 py-0.5 font-medium text-secondary-foreground text-xs">
                {requisiteTypeLabel(t, requisite.type)}
              </span>
            </div>
            <Button
              className={OUTLINE_BTN}
              onClick={() => openEdit(requisite)}
              size="lg"
              type="button"
              variant="outline"
            >
              {t("profile.actions.edit")}
            </Button>
          </div>

          <div className="my-4 h-px w-full bg-border" />

          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {REQUISITE_FIELDS.map((key) => (
              <div className="flex flex-col gap-1" key={key}>
                <span className="font-medium text-foreground text-sm leading-5">
                  {t(`profile.requisites.fields.${key}`)}
                </span>
                <span className="break-words text-muted-foreground text-sm leading-5">
                  {requisite[key] || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Button
        className={cn(OUTLINE_BTN, "w-fit")}
        onClick={openCreate}
        size="lg"
        type="button"
        variant="outline"
      >
        <Plus className="size-4" />
        {t("profile.requisites.add")}
      </Button>

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("profile.requisites.dialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rq-name">{t("profile.requisites.name")}</Label>
              <Input
                id="rq-name"
                onChange={(e) => setField("name", e.target.value)}
                placeholder={t("profile.requisites.namePlaceholder")}
                value={draft.name}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("profile.requisites.type")}</Label>
              <Select
                onValueChange={(value) => setField("type", value)}
                value={draft.type}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("profile.requisites.typePlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {REQUISITE_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {t(item.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FORM_FIELDS.map((field) => (
                <div
                  className={cn(
                    "flex flex-col gap-1.5",
                    field.full && "sm:col-span-2"
                  )}
                  key={field.key}
                >
                  <Label htmlFor={`rq-${field.key}`}>
                    {t(`profile.requisites.fields.${field.key}`)}
                  </Label>
                  <Input
                    id={`rq-${field.key}`}
                    onChange={(e) => setField(field.key, e.target.value)}
                    value={draft[field.key]}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            {editingId && (
              <Button
                className="mr-auto h-9 px-4 text-destructive text-sm hover:bg-destructive/10 hover:text-destructive"
                disabled={pending}
                onClick={() => deleteMut.mutate({ id: editingId })}
                type="button"
                variant="ghost"
              >
                {t("profile.actions.delete")}
              </Button>
            )}
            <Button
              className="h-9 px-4 text-sm"
              onClick={() => setDialogOpen(false)}
              type="button"
              variant="outline"
            >
              {t("profile.actions.cancel")}
            </Button>
            <Button
              className={APPLY_BTN}
              disabled={pending}
              onClick={save}
              type="button"
            >
              {editingId ? t("profile.actions.save") : t("profile.actions.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SecurityRow({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-semibold text-base text-foreground leading-5">
          {title}
        </h3>
        <p className="text-base text-muted-foreground leading-5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">{action}</div>
    </div>
  );
}

function TwoFactorRow() {
  const { t } = useTranslation();
  const trpc = useTRPC();
  const { data: me } = useQuery(trpc.account.me.queryOptions());
  const [dialogMode, setDialogMode] = useState<"enable" | "disable" | null>(
    null
  );

  const enabled = Boolean(me?.twoFactorEnabled);
  const hasEmail = Boolean(me?.email);
  const toggleButton = (
    <Button
      className="border-[#d4d4d4] bg-transparent text-foreground text-sm"
      disabled={!(enabled || hasEmail)}
      onClick={() => setDialogMode(enabled ? "disable" : "enable")}
      size="lg"
      type="button"
      variant="outline"
    >
      {enabled
        ? t("profile.security.twoFactor.disable")
        : t("profile.security.twoFactor.enable")}
    </Button>
  );

  return (
    <SecurityRow
      action={
        <>
          {enabled || hasEmail ? (
            toggleButton
          ) : (
            <Tooltip>
              {/* Задизейбленная кнопка не ловит hover — тултип вешаем на обёртку */}
              <TooltipTrigger asChild>
                <span className="inline-flex">{toggleButton}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-52 text-center">
                {t("profile.security.twoFactor.needEmail")}
              </TooltipContent>
            </Tooltip>
          )}
          <TwoFactorDialog
            email={me?.email ?? null}
            mode={dialogMode ?? "enable"}
            onClose={() => setDialogMode(null)}
            open={dialogMode !== null}
          />
        </>
      }
      subtitle={
        enabled
          ? t("profile.security.twoFactor.enabled")
          : t("profile.security.twoFactor.disabled")
      }
      title={t("profile.security.twoFactor.title")}
    />
  );
}

function SecurityTab() {
  const { t } = useTranslation();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  return (
    <section className="flex flex-col divide-y divide-border">
      <SecurityRow
        action={
          <>
            <button
              className="px-2 text-foreground text-sm hover:underline"
              onClick={() => setForgotPasswordOpen(true)}
              type="button"
            >
              {t("profile.security.forgotPassword")}
            </button>
            <ForgotPasswordDialog
              onClose={() => setForgotPasswordOpen(false)}
              open={forgotPasswordOpen}
            />
            <Button
              className="border-[#d4d4d4] bg-transparent text-foreground text-sm"
              onClick={() => setChangePasswordOpen(true)}
              size="lg"
              variant="outline"
            >
              {t("profile.security.changePassword")}
            </Button>
            <ChangePasswordDialog
              onClose={() => setChangePasswordOpen(false)}
              open={changePasswordOpen}
            />
          </>
        }
        subtitle="********"
        title={t("profile.security.password")}
      />
      <TwoFactorRow />
    </section>
  );
}

const OUTLINE_BTN = "border-[#d4d4d4] bg-transparent text-foreground text-sm";
const APPLY_BTN =
  "h-9 bg-foreground px-4 text-background text-sm hover:bg-foreground/90";

// Коды языков документа хранятся в БД — переводим только названия.
const DOCUMENT_LANGUAGES: { value: "ru" | "kk"; labelKey: string }[] = [
  { value: "ru", labelKey: "profile.personal.language.ru" },
  { value: "kk", labelKey: "profile.personal.language.kk" },
];

function documentLanguageLabel(t: TFunction, code: string | null): string {
  const known =
    DOCUMENT_LANGUAGES.find((item) => item.value === code) ??
    DOCUMENT_LANGUAGES[0];
  return t(known.labelKey);
}

type EditField = "name" | "email" | "phone" | "language" | null;

function FieldDialog({
  open,
  onClose,
  title,
  pending,
  onApply,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  pending: boolean;
  onApply: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-1">{children}</div>
        <DialogFooter>
          <Button
            className="h-9 px-4 text-sm"
            onClick={onClose}
            type="button"
            variant="outline"
          >
            {t("profile.actions.cancel")}
          </Button>
          <Button
            className={APPLY_BTN}
            disabled={pending}
            onClick={onApply}
            type="button"
          >
            {t("profile.actions.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PersonalDataTab() {
  const { t } = useTranslation();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: me } = useQuery(trpc.account.me.queryOptions());

  const [editing, setEditing] = useState<EditField>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [languageDraft, setLanguageDraft] = useState("ru");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const update = useMutation(
    trpc.account.updateProfile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.account.me.queryFilter());
        toast.success(t("profile.actions.saved"));
        setEditing(null);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const openName = () => {
    const [first, ...rest] = (me?.name ?? "").trim().split(" ");
    setFirstName(first ?? "");
    setLastName(rest.join(" "));
    setEditing("name");
  };
  const openEmail = () => setEditing("email");
  const openPhone = () => setEditing("phone");
  const openLanguage = () => {
    setLanguageDraft(me?.contractLanguage ?? "ru");
    setEditing("language");
  };

  const hasEmail = Boolean(me?.email);

  return (
    <section className="flex flex-col divide-y divide-border">
      {/* Фотография профиля */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {me?.image ? (
            <img
              alt={t("profile.personal.photo.alt")}
              className="size-12 shrink-0 rounded-full object-cover"
              height={48}
              src={me.image}
              width={48}
            />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <User className="size-6" />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="font-semibold text-base text-foreground leading-5">
              {t("profile.personal.photo.title")}
            </h3>
            <p className="text-base text-muted-foreground leading-5">
              {t("profile.personal.photo.subtitle")}
            </p>
          </div>
        </div>
        <Button
          className={OUTLINE_BTN}
          onClick={() => toast.info(t("profile.personal.photo.comingSoon"))}
          size="lg"
          type="button"
          variant="outline"
        >
          {t("profile.personal.photo.change")}
        </Button>
      </div>

      <SecurityRow
        action={
          <Button
            className={OUTLINE_BTN}
            onClick={openName}
            size="lg"
            type="button"
            variant="outline"
          >
            {t("profile.actions.edit")}
          </Button>
        }
        subtitle={me?.name || "—"}
        title={t("profile.personal.fullName")}
      />

      <SecurityRow
        action={
          <Button
            className={OUTLINE_BTN}
            onClick={openEmail}
            size="lg"
            type="button"
            variant="outline"
          >
            {hasEmail
              ? t("profile.personal.email.change")
              : t("profile.personal.email.add")}
          </Button>
        }
        subtitle={me?.email || t("profile.personal.email.empty")}
        title={t("profile.personal.email.title")}
      />

      <SecurityRow
        action={
          <Button
            className={OUTLINE_BTN}
            onClick={openPhone}
            size="lg"
            type="button"
            variant="outline"
          >
            {t("profile.personal.phone.change")}
          </Button>
        }
        subtitle={me?.phoneNumber || t("profile.personal.phone.empty")}
        title={t("profile.personal.phone.title")}
      />

      <SecurityRow
        action={
          <Button
            className={OUTLINE_BTN}
            onClick={openLanguage}
            size="lg"
            type="button"
            variant="outline"
          >
            {t("profile.personal.language.change")}
          </Button>
        }
        subtitle={documentLanguageLabel(t, me?.contractLanguage ?? null)}
        title={t("profile.personal.language.title")}
      />

      {/* Удалить аккаунт */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="font-semibold text-base text-destructive leading-5">
            {t("profile.personal.deleteAccount.title")}
          </h3>
          <p className="text-base text-muted-foreground leading-5">
            {t("profile.personal.deleteAccount.subtitle")}
          </p>
        </div>
        <Button
          className="border-destructive/40 bg-transparent text-destructive text-sm hover:bg-destructive/10 hover:text-destructive"
          disabled={!me}
          onClick={() => setDeleteOpen(true)}
          size="lg"
          type="button"
          variant="outline"
        >
          {t("profile.personal.deleteAccount.action")}
        </Button>
      </div>

      <DeleteAccountDialog
        email={me?.email ?? null}
        onClose={() => setDeleteOpen(false)}
        open={deleteOpen}
        phoneNumber={me?.phoneNumber ?? null}
      />

      {/* --- Edit dialogs --- */}
      <FieldDialog
        onApply={() =>
          update.mutate({ name: `${firstName} ${lastName}`.trim() })
        }
        onClose={() => setEditing(null)}
        open={editing === "name"}
        pending={update.isPending}
        title={t("profile.personal.nameDialog.title")}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pd-first">
            {t("profile.personal.nameDialog.firstName")}
          </Label>
          <Input
            id="pd-first"
            onChange={(e) => setFirstName(e.target.value)}
            value={firstName}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pd-last">
            {t("profile.personal.nameDialog.lastName")}
          </Label>
          <Input
            id="pd-last"
            onChange={(e) => setLastName(e.target.value)}
            value={lastName}
          />
        </div>
      </FieldDialog>

      <VerifyContactDialog
        channel="email"
        currentValue={me?.email ?? null}
        onClose={() => setEditing(null)}
        open={editing === "email"}
      />

      <VerifyContactDialog
        channel="phone"
        currentValue={me?.phoneNumber ?? null}
        onClose={() => setEditing(null)}
        open={editing === "phone"}
      />

      <FieldDialog
        onApply={() =>
          update.mutate({
            contractLanguage: languageDraft as "ru" | "kk",
          })
        }
        onClose={() => setEditing(null)}
        open={editing === "language"}
        pending={update.isPending}
        title={t("profile.personal.language.title")}
      >
        <div className="flex flex-col gap-1.5">
          <Label>{t("profile.personal.language.label")}</Label>
          <Select onValueChange={setLanguageDraft} value={languageDraft}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_LANGUAGES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {t(item.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FieldDialog>
    </section>
  );
}

function ProfilePage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState<ProfileTab>(
    search.tab ?? "personal"
  );

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex flex-col">
        {/* Navigation: heading + tab bar */}
        <div className="flex flex-col gap-4 px-4 pt-4 sm:px-6">
          <h1 className="font-semibold text-2xl text-foreground leading-7">
            {t("profile.title")}
          </h1>
          {/* Табы не влезают на мобильных — скроллим по горизонтали */}
          <div className="flex items-start gap-1 overflow-x-auto border-border border-b">
            {PROFILE_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  className={cn(
                    "-mb-px flex shrink-0 flex-col items-stretch whitespace-nowrap border-b pb-2 transition-colors",
                    isActive ? "border-foreground" : "border-transparent"
                  )}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  <span
                    className={cn(
                      "inline-flex min-h-[29px] items-center justify-center rounded-md px-2 py-1 text-sm leading-[18px] transition-colors",
                      isActive
                        ? "border border-border text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t(tab.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content per active tab */}
        <div className="px-4 py-4 sm:px-6">
          {activeTab === "subscription" && (
            <SubscriptionTab justPaid={search.subscribed} />
          )}
          {activeTab === "personal" && <PersonalDataTab />}
          {activeTab === "security" && <SecurityTab />}
          {activeTab === "requisites" && <RequisitesTab />}
        </div>
      </div>
    </div>
  );
}
