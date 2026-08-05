import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Plus, Settings, User } from "lucide-react";
import { useState } from "react";
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

const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: "personal", label: "Личные данные" },
  { id: "security", label: "Безопасность" },
  { id: "requisites", label: "Реквизиты" },
  { id: "subscription", label: "Подписка" },
];

// Карточки тарифов и переключатель периода живут в общем компоненте
// PlansPicker (используется и попапом «Тарифы» в модалках шаблона).

const MONTHS_RU = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

function formatPurchaseDate(value: Date | string): string {
  const d = new Date(value);
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}, ${d.getFullYear()}`;
}

function formatExpiryFull(value: Date | string): string {
  const d = new Date(value);
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()} года`;
}

function statusMeta(status: string): { label: string; className: string } {
  if (status === "paid") {
    return { label: "Оплачен", className: "text-[#2e6b2e]" };
  }
  if (status === "expired") {
    return { label: "Просрочен", className: "text-destructive" };
  }
  if (status === "failed") {
    return { label: "Не оплачен", className: "text-destructive" };
  }
  return { label: "Ожидает оплаты", className: "text-muted-foreground" };
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
  my:
    | {
        isPaid: boolean;
        expiresAt: Date | string | null;
        cancelledAt: Date | string | null;
      }
    | undefined
): string {
  if (!my?.isPaid) {
    return "Бесплатный тариф — без ограничения по сроку";
  }
  if (!my.expiresAt) {
    return "Подписка без ограничения по сроку";
  }
  if (my.cancelledAt) {
    return `Подписка отменена — активна до ${formatPurchaseDate(my.expiresAt)}`;
  }
  return `Действует до ${formatPurchaseDate(my.expiresAt)}`;
}

function SubscriptionTab({ justPaid }: { justPaid?: boolean }) {
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
        toast.error(err.message || "Не удалось перейти к оплате");
      },
    })
  );

  return (
    <section className="flex flex-col gap-6">
      {/* Current subscription */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-foreground text-lg leading-6">
            {my?.planName ?? "Без подписки"}
          </h3>
          <p className="text-muted-foreground text-sm">
            {subscriptionSubtitle(my)}
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
          Управлять подпиской
        </Button>
      </div>

      <SubscriptionManageDialog
        checksQuota={checksQuota}
        onOpenChange={setManageOpen}
        open={manageOpen}
      />

      {/* Usage */}
      {my && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <UsageCard
            label="Использовано загрузок"
            quota={my.downloadQuota}
            used={my.downloadsUsed}
          />
          <UsageCard
            label="Использовано редактирований"
            quota={my.editQuota}
            used={my.editsUsed}
          />
          <UsageCard
            label="Использовано проверок"
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
            История покупок
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <tbody>
                {history.map((item) => {
                  const meta = statusMeta(item.status);
                  const label =
                    item.description ||
                    (item.purpose === "subscription" ? "Подписка" : "Договор");
                  return (
                    <tr
                      className="border-border border-b last:border-b-0"
                      key={item.invId}
                    >
                      <td className="py-3 pr-4 text-foreground">{label}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatPurchaseDate(item.createdAt)}
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
                          onClick={() => toast.info("Скоро будет доступно")}
                          type="button"
                        >
                          {item.status === "paid" ? "Квитанция" : "Оплатить"}
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
                Подписка возобновлена!
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Тариф «{my?.planName}» активирован.
                {my?.expiresAt &&
                  ` Действует до ${formatExpiryFull(my.expiresAt)}.`}
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

// Editable inputs in the dialog (name/type are rendered separately above them).
const FORM_FIELDS: {
  label: string;
  key: keyof RequisiteDraft;
  full?: boolean;
}[] = [
  { label: "ИИН/БИН", key: "inn" },
  { label: "Юридический адрес", key: "address", full: true },
  { label: "Номер телефона", key: "phone" },
  { label: "Электронная почта", key: "email" },
  { label: "Банк", key: "bank" },
  { label: "IBAN", key: "iban" },
  { label: "БИК", key: "bik" },
  { label: "КБе", key: "kbe" },
  { label: "КНП", key: "knp" },
  { label: "Подписант", key: "signatory", full: true },
  { label: "Должность", key: "position" },
  { label: "Действует на основании", key: "basis" },
];

const REQUISITE_FIELDS: { label: string; key: keyof Requisite }[] = [
  { label: "ИИН/БИН", key: "inn" },
  { label: "Юридический адрес", key: "address" },
  { label: "Номер телефона", key: "phone" },
  { label: "Электронная почта", key: "email" },
  { label: "Банк", key: "bank" },
  { label: "IBAN", key: "iban" },
  { label: "БИК", key: "bik" },
  { label: "КБе", key: "kbe" },
  { label: "КНП", key: "knp" },
  { label: "Подписант", key: "signatory" },
  { label: "Должность", key: "position" },
  { label: "Действует на основании", key: "basis" },
];

function RequisitesTab() {
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
        toast.success("Реквизиты добавлены");
        setDialogOpen(false);
      },
      onError: (err) => toast.error(err.message),
    })
  );
  const updateMut = useMutation(
    trpc.requisites.update.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Сохранено");
        setDialogOpen(false);
      },
      onError: (err) => toast.error(err.message),
    })
  );
  const deleteMut = useMutation(
    trpc.requisites.delete.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Удалено");
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
      toast.error("Укажите наименование");
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
          Загрузка реквизитов…
        </p>
      )}

      {!isLoading && requisites.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border border-dashed py-16">
          <p className="font-medium text-foreground text-sm">
            Реквизитов пока нет
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            Добавьте реквизиты — они будут подставляться в договоры
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
                {requisite.type}
              </span>
            </div>
            <Button
              className={OUTLINE_BTN}
              onClick={() => openEdit(requisite)}
              size="lg"
              type="button"
              variant="outline"
            >
              Редактировать
            </Button>
          </div>

          <div className="my-4 h-px w-full bg-border" />

          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {REQUISITE_FIELDS.map((field) => (
              <div className="flex flex-col gap-1" key={field.label}>
                <span className="font-medium text-foreground text-sm leading-5">
                  {field.label}
                </span>
                <span className="break-words text-muted-foreground text-sm leading-5">
                  {requisite[field.key] || "—"}
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
        Добавить реквизиты
      </Button>

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Об организации</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rq-name">Наименование</Label>
              <Input
                id="rq-name"
                onChange={(e) => setField("name", e.target.value)}
                placeholder="ТОО «Название компании»"
                value={draft.name}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Тип</Label>
              <Select
                onValueChange={(value) => setField("type", value)}
                value={draft.type}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ТОО">ТОО</SelectItem>
                  <SelectItem value="ИП">ИП</SelectItem>
                  <SelectItem value="АО">АО</SelectItem>
                  <SelectItem value="Физ. лицо">Физ. лицо</SelectItem>
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
                  <Label htmlFor={`rq-${field.key}`}>{field.label}</Label>
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
                Удалить
              </Button>
            )}
            <Button
              className="h-9 px-4 text-sm"
              onClick={() => setDialogOpen(false)}
              type="button"
              variant="outline"
            >
              Отменить
            </Button>
            <Button
              className={APPLY_BTN}
              disabled={pending}
              onClick={save}
              type="button"
            >
              {editingId ? "Сохранить" : "Добавить"}
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
      {enabled ? "Отключить" : "Включить"}
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
                Укажите почту в разделе «Личные данные», чтобы подключить 2FA
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
      subtitle={enabled ? "Включена" : "Выключена"}
      title="Двухфакторная аутентификация"
    />
  );
}

function SecurityTab() {
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
              Забыли пароль?
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
              Изменить пароль
            </Button>
            <ChangePasswordDialog
              onClose={() => setChangePasswordOpen(false)}
              open={changePasswordOpen}
            />
          </>
        }
        subtitle="********"
        title="Пароль"
      />
      <TwoFactorRow />
    </section>
  );
}

const OUTLINE_BTN = "border-[#d4d4d4] bg-transparent text-foreground text-sm";
const APPLY_BTN =
  "h-9 bg-foreground px-4 text-background text-sm hover:bg-foreground/90";

const LANGUAGE_LABELS: Record<string, string> = {
  ru: "Русский",
  kk: "Қазақша",
  en: "English",
};

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
            Отменить
          </Button>
          <Button
            className={APPLY_BTN}
            disabled={pending}
            onClick={onApply}
            type="button"
          >
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PersonalDataTab() {
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
        toast.success("Сохранено");
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
              alt="Аватар"
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
              Фотография профиля
            </h3>
            <p className="text-base text-muted-foreground leading-5">
              Ваша аватарка, которая отображается в команде
            </p>
          </div>
        </div>
        <Button
          className={OUTLINE_BTN}
          onClick={() => toast.info("Загрузка фото скоро будет доступна")}
          size="lg"
          type="button"
          variant="outline"
        >
          Сменить фото
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
            Редактировать
          </Button>
        }
        subtitle={me?.name || "—"}
        title="Ф.И.О."
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
            {hasEmail ? "Сменить почту" : "Добавить почту"}
          </Button>
        }
        subtitle={me?.email || "Вы еще не указали электронную почту"}
        title="Электронная почта"
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
            Сменить номер
          </Button>
        }
        subtitle={me?.phoneNumber || "Не указан"}
        title="Номер телефона"
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
            Сменить язык
          </Button>
        }
        subtitle={LANGUAGE_LABELS[me?.contractLanguage ?? "ru"]}
        title="Язык по умолчанию в договорах"
      />

      {/* Удалить аккаунт */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="font-semibold text-base text-destructive leading-5">
            Удалить аккаунт
          </h3>
          <p className="text-base text-muted-foreground leading-5">
            Полное удаление вашего аккаунта на платформе Zhebe.
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
          Удалить аккаунт
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
        title="Личные данные"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pd-first">Имя</Label>
          <Input
            id="pd-first"
            onChange={(e) => setFirstName(e.target.value)}
            value={firstName}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pd-last">Фамилия</Label>
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
            contractLanguage: languageDraft as "ru" | "kk" | "en",
          })
        }
        onClose={() => setEditing(null)}
        open={editing === "language"}
        pending={update.isPending}
        title="Язык по умолчанию в договорах"
      >
        <div className="flex flex-col gap-1.5">
          <Label>Язык</Label>
          <Select onValueChange={setLanguageDraft} value={languageDraft}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ru">Русский</SelectItem>
              <SelectItem value="kk">Қазақша</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FieldDialog>
    </section>
  );
}

function ProfilePage() {
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
            Профиль
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
                    {tab.label}
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
