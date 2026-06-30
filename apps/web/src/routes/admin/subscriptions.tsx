import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PaginationControls } from "@/components/pagination-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "@/lib/auth-guard";
import { useTRPC } from "@/utils/trpc";

const PAGE_SIZE = 25;

export const Route = createFileRoute("/admin/subscriptions")({
  component: AdminSubscriptionsPage,
  beforeLoad: async () => {
    const { session } = await requireAdmin();
    return { session };
  },
});

interface PlanFeature {
  label: string;
  value: string;
}

interface PlanRow {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceQuarterly: number | null;
  priceYearly: number | null;
  discountLabel: string | null;
  downloadQuota: number;
  editQuota: number;
  features: PlanFeature[];
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
}

function quotaLabel(value: number): string {
  return value === -1 ? "∞" : String(value);
}

function AdminSubscriptionsPage() {
  const [tab, setTab] = useState<"plans" | "users">("plans");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="shrink-0 border-b px-6 py-4">
        <h1 className="font-semibold text-lg">Подписки</h1>
        <div className="mt-3 flex gap-2">
          <button
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === "plans" ? "bg-muted font-medium" : "text-muted-foreground"
            }`}
            onClick={() => setTab("plans")}
            type="button"
          >
            Тарифы
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === "users" ? "bg-muted font-medium" : "text-muted-foreground"
            }`}
            onClick={() => setTab("users")}
            type="button"
          >
            Подписки пользователей
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tab === "plans" ? <PlansTab /> : <UsersTab />}
      </div>
    </div>
  );
}

// --- Plans tab -------------------------------------------------------------

function PlansTab() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: plans = [] } = useQuery(trpc.admin.plans.queryOptions());
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [creating, setCreating] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.admin.plans.queryKey() });

  const deleteMutation = useMutation(
    trpc.admin.deletePlan.mutationOptions({
      onSuccess: () => {
        toast.success("Тариф удалён");
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    })
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} size="sm">
          <Plus className="mr-1.5 size-4" />
          Новый тариф
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground text-xs">
            <tr>
              <th className="px-4 py-2 font-medium" scope="col">
                Тариф
              </th>
              <th className="px-4 py-2 font-medium" scope="col">
                Цена/мес
              </th>
              <th className="px-4 py-2 font-medium" scope="col">
                Скачивания
              </th>
              <th className="px-4 py-2 font-medium" scope="col">
                Редактирования
              </th>
              <th className="px-4 py-2 font-medium" scope="col">
                Статус
              </th>
              <th className="px-4 py-2" scope="col" />
            </tr>
          </thead>
          <tbody>
            {(plans as PlanRow[]).map((plan) => (
              <tr className="border-t" key={plan.id}>
                <td className="px-4 py-2 font-medium">
                  {plan.name}
                  {plan.isDefault && (
                    <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
                      по умолчанию
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {plan.priceMonthly.toLocaleString("ru-RU")} ₸
                </td>
                <td className="px-4 py-2">{quotaLabel(plan.downloadQuota)}</td>
                <td className="px-4 py-2">{quotaLabel(plan.editQuota)}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {plan.isActive ? "Активен" : "Скрыт"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      onClick={() => setEditing(plan)}
                      size="sm"
                      variant="outline"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      onClick={() => deleteMutation.mutate({ id: plan.id })}
                      size="sm"
                      variant="outline"
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <PlanDialog
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={invalidate}
          plan={editing}
        />
      )}
    </div>
  );
}

const EMPTY_PLAN = {
  name: "",
  description: "",
  priceMonthly: "0",
  priceQuarterly: "",
  priceYearly: "",
  discountLabel: "",
  downloadQuota: "0",
  editQuota: "0",
  sortOrder: "0",
  isActive: true,
  isDefault: false,
  features: [] as PlanFeature[],
};

function planToForm(plan: PlanRow) {
  return {
    name: plan.name,
    description: plan.description,
    priceMonthly: String(plan.priceMonthly),
    priceQuarterly:
      plan.priceQuarterly == null ? "" : String(plan.priceQuarterly),
    priceYearly: plan.priceYearly == null ? "" : String(plan.priceYearly),
    discountLabel: plan.discountLabel ?? "",
    downloadQuota: String(plan.downloadQuota),
    editQuota: String(plan.editQuota),
    sortOrder: String(plan.sortOrder),
    isActive: plan.isActive,
    isDefault: plan.isDefault,
    features: plan.features ?? [],
  };
}

function PlanDialog({
  plan,
  onClose,
  onSaved,
}: {
  plan: PlanRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const trpc = useTRPC();
  const [form, setForm] = useState(plan ? planToForm(plan) : EMPTY_PLAN);

  const onDone = () => {
    toast.success(plan ? "Тариф обновлён" : "Тариф создан");
    onSaved();
    onClose();
  };
  const createMutation = useMutation(
    trpc.admin.createPlan.mutationOptions({
      onSuccess: onDone,
      onError: (e) => toast.error(e.message),
    })
  );
  const updateMutation = useMutation(
    trpc.admin.updatePlan.mutationOptions({
      onSuccess: onDone,
      onError: (e) => toast.error(e.message),
    })
  );

  const submit = () => {
    const payload = {
      name: form.name,
      description: form.description,
      priceMonthly: Number(form.priceMonthly) || 0,
      priceQuarterly: form.priceQuarterly ? Number(form.priceQuarterly) : null,
      priceYearly: form.priceYearly ? Number(form.priceYearly) : null,
      discountLabel: form.discountLabel || null,
      downloadQuota: Number(form.downloadQuota) || 0,
      editQuota: Number(form.editQuota) || 0,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
      isDefault: form.isDefault,
      features: form.features.filter((f) => f.label.trim()),
    };
    if (plan) {
      updateMutation.mutate({ id: plan.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const setFeature = (i: number, next: PlanFeature) => {
    const features = [...form.features];
    features[i] = next;
    setForm({ ...form, features });
  };

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{plan ? "Изменить тариф" : "Новый тариф"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-auto p-6">
          <div className="grid gap-2">
            <Label htmlFor="plan-name">Название</Label>
            <Input
              id="plan-name"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              value={form.name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plan-desc">Описание</Label>
            <Input
              id="plan-desc"
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              value={form.description}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="plan-price">Цена/мес (₸)</Label>
              <Input
                id="plan-price"
                onChange={(e) =>
                  setForm({ ...form, priceMonthly: e.target.value })
                }
                type="number"
                value={form.priceMonthly}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-discount">Скидка (бейдж)</Label>
              <Input
                id="plan-discount"
                onChange={(e) =>
                  setForm({ ...form, discountLabel: e.target.value })
                }
                placeholder="-20%"
                value={form.discountLabel}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="plan-price-q">Цена/квартал (₸)</Label>
              <Input
                id="plan-price-q"
                onChange={(e) =>
                  setForm({ ...form, priceQuarterly: e.target.value })
                }
                placeholder="пусто = мес × 3"
                type="number"
                value={form.priceQuarterly}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-price-y">Цена/год (₸)</Label>
              <Input
                id="plan-price-y"
                onChange={(e) =>
                  setForm({ ...form, priceYearly: e.target.value })
                }
                placeholder="пусто = мес × 12"
                type="number"
                value={form.priceYearly}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="plan-dl">Скачивания (-1 = ∞)</Label>
              <Input
                id="plan-dl"
                onChange={(e) =>
                  setForm({ ...form, downloadQuota: e.target.value })
                }
                type="number"
                value={form.downloadQuota}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-ed">Редакт. (-1 = ∞)</Label>
              <Input
                id="plan-ed"
                onChange={(e) =>
                  setForm({ ...form, editQuota: e.target.value })
                }
                type="number"
                value={form.editQuota}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-order">Порядок</Label>
              <Input
                id="plan-order"
                onChange={(e) =>
                  setForm({ ...form, sortOrder: e.target.value })
                }
                type="number"
                value={form.sortOrder}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
                type="checkbox"
              />
              Активен (виден в профиле)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={form.isDefault}
                onChange={(e) =>
                  setForm({ ...form, isDefault: e.target.checked })
                }
                type="checkbox"
              />
              По умолчанию
            </label>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Функции (отображение)</Label>
              <Button
                onClick={() =>
                  setForm({
                    ...form,
                    features: [...form.features, { label: "", value: "" }],
                  })
                }
                size="sm"
                variant="outline"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
            {form.features.map((f, i) => (
              <div className="flex gap-2" key={`${f.label}-${i}`}>
                <Input
                  onChange={(e) =>
                    setFeature(i, { ...f, label: e.target.value })
                  }
                  placeholder="Название"
                  value={f.label}
                />
                <Input
                  onChange={(e) =>
                    setFeature(i, { ...f, value: e.target.value })
                  }
                  placeholder="Значение"
                  value={f.value}
                />
                <Button
                  onClick={() =>
                    setForm({
                      ...form,
                      features: form.features.filter((_, j) => j !== i),
                    })
                  }
                  size="sm"
                  variant="outline"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button onClick={onClose} size="sm" variant="outline">
            Отмена
          </Button>
          <Button
            disabled={
              !form.name || createMutation.isPending || updateMutation.isPending
            }
            onClick={submit}
            size="sm"
          >
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Users tab -------------------------------------------------------------

interface SubRow {
  userId: string;
  name: string;
  email: string | null;
  planId: string | null;
  planName: string | null;
  expiresAt: string | Date | null;
  downloadsUsed: number | null;
  editsUsed: number | null;
}

function UsersTab() {
  const trpc = useTRPC();
  const [page, setPage] = useState(1);
  const { data } = useQuery(
    trpc.admin.subscriptions.queryOptions({ page, pageSize: PAGE_SIZE })
  );
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const { data: plans = [] } = useQuery(trpc.admin.plans.queryOptions());
  const [editing, setEditing] = useState<SubRow | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground text-xs">
            <tr>
              <th className="px-4 py-2 font-medium" scope="col">
                Пользователь
              </th>
              <th className="px-4 py-2 font-medium" scope="col">
                Тариф
              </th>
              <th className="px-4 py-2 font-medium" scope="col">
                Использовано (мес)
              </th>
              <th className="px-4 py-2 font-medium" scope="col">
                До
              </th>
              <th className="px-4 py-2" scope="col" />
            </tr>
          </thead>
          <tbody>
            {(rows as SubRow[]).map((row) => (
              <tr className="border-t" key={row.userId}>
                <td className="px-4 py-2">
                  <div className="font-medium">{row.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {row.email ?? ""}
                  </div>
                </td>
                <td className="px-4 py-2">{row.planName ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  ↓{row.downloadsUsed ?? 0} · ✎{row.editsUsed ?? 0}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {row.expiresAt
                    ? new Date(row.expiresAt).toLocaleDateString("ru-RU")
                    : "—"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setEditing(row)}
                      size="sm"
                      variant="outline"
                    >
                      Изменить
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationControls
        onPageChange={setPage}
        page={page}
        pageCount={pageCount}
      />

      {editing && (
        <SubscriptionDialog
          onClose={() => setEditing(null)}
          plans={plans as PlanRow[]}
          row={editing}
        />
      )}
    </div>
  );
}

function toDateInput(value: string | Date | null): string {
  if (!value) {
    return "";
  }
  return new Date(value).toISOString().slice(0, 10);
}

function SubscriptionDialog({
  row,
  plans,
  onClose,
}: {
  row: SubRow;
  plans: PlanRow[];
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [planId, setPlanId] = useState(row.planId ?? "");
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [expiresAt, setExpiresAt] = useState(toDateInput(row.expiresAt));

  const mutation = useMutation(
    trpc.admin.setUserSubscription.mutationOptions({
      onSuccess: () => {
        toast.success("Подписка обновлена");
        queryClient.invalidateQueries({
          queryKey: trpc.admin.subscriptions.queryKey(),
        });
        onClose();
      },
      onError: (e) => toast.error(e.message),
    })
  );

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Подписка — {row.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="sub-plan">Тариф</Label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
              id="sub-plan"
              onChange={(e) => setPlanId(e.target.value)}
              value={planId}
            >
              <option value="">— без подписки (дефолт) —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sub-period">Период</Label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
              id="sub-period"
              onChange={(e) =>
                setPeriod(e.target.value as "monthly" | "yearly")
              }
              value={period}
            >
              <option value="monthly">Месяц</option>
              <option value="yearly">Год</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sub-expires">
              Действует до (пусто = бессрочно)
            </Label>
            <Input
              id="sub-expires"
              onChange={(e) => setExpiresAt(e.target.value)}
              type="date"
              value={expiresAt}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose} size="sm" variant="outline">
            Отмена
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                userId: row.userId,
                planId: planId || null,
                period,
                expiresAt: expiresAt || null,
              })
            }
            size="sm"
          >
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
