import { Check, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Сетка «Доступные планы» с переключателем периода — общая для вкладки
// «Подписка» в профиле и попапа «Тарифы» в модалках скачивания/редактирования.

export const PERIODS = [
  { key: "monthly", label: "Ежемесячно", suffix: "/ в месяц" },
  { key: "quarterly", label: "Ежеквартально (- 7%)", suffix: "/ в квартал" },
  { key: "yearly", label: "Ежегодно (-22%)", suffix: "/ в год" },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"];

export interface PlanFeature {
  label: string;
  value: string;
}

export interface DbPlan {
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
}

interface PlanCardData {
  id: string;
  name: string;
  discount?: string;
  description: string;
  price: string;
  period?: string;
  cta: string;
  current: boolean;
  // Always-included usage quotas (shown above the divider).
  quotas: PlanFeature[];
  // Per-plan capabilities (shown below the divider). value === NOT_INCLUDED
  // renders muted with an "x" icon.
  features: PlanFeature[];
}

const NOT_INCLUDED = "—";

function FeatureRow({ label, value }: PlanFeature) {
  const included = value !== NOT_INCLUDED;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {included ? (
          <Check className="mt-0.5 size-3 shrink-0 text-foreground" />
        ) : (
          <X className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
        )}
        <span
          className={cn(
            "text-xs",
            included ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
      </div>
      <span className="shrink-0 text-foreground text-xs">{value}</span>
    </div>
  );
}

export function PlanCard({
  plan,
  onSelect,
  loading,
}: {
  plan: PlanCardData;
  onSelect?: () => void;
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border px-5 py-6",
        plan.current
          ? "border-primary bg-primary/[0.03]"
          : "border-border bg-card"
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <h3 className="flex-1 font-medium text-foreground text-xl leading-6">
            {plan.name}
          </h3>
          {plan.discount && (
            <span className="rounded-full bg-[#ddcdd5]/60 px-2 py-1 font-medium text-[11px] text-primary">
              {plan.discount}
            </span>
          )}
        </div>
        <p className="text-foreground text-xs leading-4">{plan.description}</p>
      </div>

      <div className="flex items-end gap-1">
        <span className="font-medium text-foreground text-lg leading-[22px]">
          {plan.price}
        </span>
        {plan.period && (
          <span className="pb-px text-muted-foreground text-xs">
            {plan.period}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {plan.quotas.map((quota) => (
          <div
            className="flex items-center justify-between gap-2"
            key={quota.label}
          >
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <Check className="mt-0.5 size-3 shrink-0 text-foreground" />
              <span className="text-foreground text-xs">{quota.label}</span>
            </div>
            <span className="shrink-0 text-foreground text-xs">
              {quota.value}
            </span>
          </div>
        ))}
      </div>

      <Button
        className="h-8 w-full"
        disabled={plan.current || !onSelect || loading}
        onClick={onSelect}
        variant="outline"
      >
        {loading ? "Переход к оплате…" : plan.cta}
      </Button>

      <div className="h-px w-full bg-border" />

      <div className="flex flex-col gap-2">
        {plan.features.map((feature) => (
          <FeatureRow
            key={feature.label}
            label={feature.label}
            value={feature.value}
          />
        ))}
      </div>
    </div>
  );
}

export function quotaText(n: number): string {
  return n === -1 ? "∞" : String(n);
}

function planCta(name: string, isFree: boolean, isCurrent: boolean): string {
  if (isFree) {
    return "Ваш тариф";
  }
  if (isCurrent) {
    return "Текущий тариф";
  }
  return `Перейти на ${name}`;
}

// Price for the selected billing period. Quarterly/yearly fall back to the
// monthly price × 3 / × 12 when an explicit price isn't set (mirrors checkout).
export function priceForPeriod(p: DbPlan, period: PeriodKey): number {
  if (period === "yearly") {
    return p.priceYearly ?? p.priceMonthly * 12;
  }
  if (period === "quarterly") {
    return p.priceQuarterly ?? p.priceMonthly * 3;
  }
  return p.priceMonthly;
}

export function dbPlanToCard(
  p: DbPlan,
  currentPlanId: string | null,
  period: PeriodKey
): PlanCardData {
  const isFree = p.priceMonthly === 0;
  const isCurrent = p.id === currentPlanId;
  const amount = priceForPeriod(p, period);
  const suffix = PERIODS.find((x) => x.key === period)?.suffix ?? "/ в месяц";
  return {
    id: p.id,
    name: p.name,
    discount: p.discountLabel ?? undefined,
    description: p.description,
    price: isFree ? "Бесплатно" : `${amount.toLocaleString("ru-RU")} ₸`,
    period: isFree ? undefined : suffix,
    cta: planCta(p.name, isFree, isCurrent),
    current: isCurrent,
    quotas: [
      { label: "Скачивание", value: quotaText(p.downloadQuota) },
      { label: "Редактирование", value: quotaText(p.editQuota) },
    ],
    features: p.features ?? [],
  };
}

/** Переключатель «Период подписки» (Ежемесячно / Ежеквартально / Ежегодно). */
export function PeriodTabs({
  period,
  onChange,
}: {
  period: PeriodKey;
  onChange: (period: PeriodKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
      <span className="text-foreground text-xs">Период подписки</span>
      <div className="flex flex-wrap items-center gap-1 rounded-[10px] bg-muted p-1">
        {PERIODS.map((option) => {
          const isActive = option.key === period;
          return (
            <button
              className={cn(
                "rounded-lg px-2 py-1 text-xs transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "border border-border text-foreground hover:bg-background/60"
              )}
              key={option.key}
              onClick={() => onChange(option.key)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Сетка тарифов целиком: заголовок «Доступные планы», период и карточки.
 * Клик по «Перейти на X» сразу ведёт к оплате выбранного плана и периода. */
export function PlansPicker({
  plans,
  currentPlanId,
  onSelectPlan,
  loadingPlanId,
}: {
  plans: DbPlan[];
  currentPlanId: string | null;
  onSelectPlan: (planId: string, period: PeriodKey) => void;
  loadingPlanId?: string | null;
}) {
  const [period, setPeriod] = useState<PeriodKey>("monthly");
  const cards = plans.map((p) => dbPlanToCard(p, currentPlanId, period));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-2xl text-foreground leading-6">
          Доступные планы
        </h2>
        <PeriodTabs onChange={setPeriod} period={period} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((plan, i) => {
          const isFree = plans[i].priceMonthly === 0;
          const canBuy = !(plan.current || isFree);
          return (
            <PlanCard
              key={plan.id}
              loading={loadingPlanId === plan.id}
              onSelect={
                canBuy ? () => onSelectPlan(plan.id, period) : undefined
              }
              plan={plan}
            />
          );
        })}
      </div>
    </div>
  );
}
