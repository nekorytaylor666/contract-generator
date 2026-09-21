import type { TFunction } from "i18next";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Сетка «Доступные планы» с переключателем периода — общая для вкладки
// «Подписка» в профиле и попапа «Тарифы» в модалках скачивания/редактирования.

// Ключи периодов уходят на сервер как есть; подписи и суффиксы цены берём из
// переводов (plans.periods.* / plans.suffix.*).
export const PERIODS = [
  {
    key: "monthly",
    labelKey: "plans.periods.monthly",
    suffixKey: "plans.suffix.monthly",
  },
  {
    key: "quarterly",
    labelKey: "plans.periods.quarterly",
    suffixKey: "plans.suffix.quarterly",
  },
  {
    key: "yearly",
    labelKey: "plans.periods.yearly",
    suffixKey: "plans.suffix.yearly",
  },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"];

export interface PlanFeature {
  label: string;
  value: string;
  labelKk?: string;
  valueKk?: string;
}

export interface DbPlan {
  id: string;
  name: string;
  description: string;
  // Казахские варианты заполняет админ; пустые — показываем русский текст.
  nameKk?: string | null;
  descriptionKk?: string | null;
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

// Под разделителем в карточке показываем только эти три возможности — как в
// макете. Остальные фичи плана остаются в БД (лимиты, админка), но карточку не
// раздувают. Порядок строк задаётся этим списком. `label` — русский ключ
// поиска фичи в БД (он там первичен), `i18nKey` — подпись для строки-заглушки,
// когда фичи у плана нет.
const CARD_FEATURES = [
  { label: "Поддержка", i18nKey: "plans.features.support" },
  { label: "Сохранение реквизитов", i18nKey: "plans.features.saveDetails" },
  { label: "Проверка документов", i18nKey: "plans.features.documentCheck" },
];

// Строки карточки ищем по русскому label (он первичен в БД), а показываем в
// языке интерфейса: казахские labelKk/valueKk с фолбэком на русские.
function cardFeatures(
  features: PlanFeature[],
  kk: boolean,
  t: TFunction
): PlanFeature[] {
  return CARD_FEATURES.map(({ label, i18nKey }) => {
    const feature = features.find((f) => f.label === label);
    if (!feature) {
      return { label: t(i18nKey), value: NOT_INCLUDED };
    }
    return localizeFeature(feature, kk);
  });
}

function pickKk(kk: boolean, ru: string, kkValue?: string | null): string {
  return kk && kkValue?.trim() ? kkValue : ru;
}

export function localizeFeature(
  feature: PlanFeature,
  kk: boolean
): PlanFeature {
  return {
    label: pickKk(kk, feature.label, feature.labelKk),
    value: pickKk(kk, feature.value, feature.valueKk),
  };
}

/** Название/описание тарифа в языке интерфейса (kk → казахские поля из БД,
 * если админ их заполнил, иначе русские). */
export function localizePlanText(
  plan: Pick<DbPlan, "name" | "description" | "nameKk" | "descriptionKk">,
  language: string
): { name: string; description: string } {
  const kk = isKazakh(language);
  return {
    name: pickKk(kk, plan.name, plan.nameKk),
    description: pickKk(kk, plan.description, plan.descriptionKk),
  };
}

export function isKazakh(language: string): boolean {
  return language.startsWith("kk");
}

/** Название тарифа для текущего языка из ответа mySubscription. */
export function planDisplayName(
  sub: { planName: string | null; planNameKk?: string | null },
  language: string
): string | null {
  if (!sub.planName) {
    return null;
  }
  return pickKk(isKazakh(language), sub.planName, sub.planNameKk);
}

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
  const { t } = useTranslation();
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
        {loading ? t("plans.goingToPayment") : plan.cta}
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

// Квоты тарифа месячные — на карточке это должно быть видно («5 / мес»).
// `perMonth` — локализованный суффикс (plans.perMonth).
export function quotaText(n: number, perMonth: string): string {
  return n === -1 ? "∞" : `${n} ${perMonth}`;
}

function planCta(
  name: string,
  isFree: boolean,
  isCurrent: boolean,
  t: TFunction
): string {
  if (isFree) {
    return t("plans.yourPlan");
  }
  if (isCurrent) {
    return t("plans.currentPlan");
  }
  return t("plans.switchTo", { name });
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
  period: PeriodKey,
  language: string,
  t: TFunction
): PlanCardData {
  const isFree = p.priceMonthly === 0;
  const isCurrent = p.id === currentPlanId;
  const amount = priceForPeriod(p, period);
  const suffixKey =
    PERIODS.find((x) => x.key === period)?.suffixKey ?? PERIODS[0].suffixKey;
  const { name, description } = localizePlanText(p, language);
  const perMonth = t("plans.perMonth");
  return {
    id: p.id,
    name,
    discount: p.discountLabel ?? undefined,
    description,
    price: isFree
      ? t("plans.free")
      : t("plans.priceValue", { price: amount.toLocaleString("ru-RU") }),
    period: isFree ? undefined : t(suffixKey),
    cta: planCta(name, isFree, isCurrent, t),
    current: isCurrent,
    quotas: [
      {
        label: t("plans.download"),
        value: quotaText(p.downloadQuota, perMonth),
      },
      { label: t("plans.edit"), value: quotaText(p.editQuota, perMonth) },
    ],
    features: cardFeatures(p.features ?? [], isKazakh(language), t),
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
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
      <span className="text-foreground text-xs">{t("plans.periodLabel")}</span>
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
              {t(option.labelKey)}
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
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<PeriodKey>("monthly");
  const cards = plans.map((p) =>
    dbPlanToCard(p, currentPlanId, period, i18n.language, t)
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-2xl text-foreground leading-6">
          {t("plans.availablePlans")}
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
