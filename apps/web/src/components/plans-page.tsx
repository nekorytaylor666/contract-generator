import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type DbPlan,
  type PeriodKey,
  PlanCard,
  priceForPeriod,
} from "@/components/plans-picker";
import { PublicFooter, PublicNavbar } from "@/components/site-chrome";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

// Публичная страница тарифов (макет «/Plans»): тёплый фон, заголовок по
// центру, переключатель периода и карточки планов из БД (subscriptions.
// plansPublic). CTA у всех карточек одна: гостя ведёт на регистрацию,
// авторизованного — в профиль к подписке.

const PAGE_BG = "#faf9f6";

const PERIOD_OPTIONS: { key: PeriodKey; labelKey: string }[] = [
  { key: "monthly", labelKey: "plansPage.periodMonthly" },
  { key: "quarterly", labelKey: "plansPage.periodQuarterly" },
  { key: "yearly", labelKey: "plansPage.periodYearly" },
];

const PERIOD_SUFFIX_KEYS: Record<PeriodKey, string> = {
  monthly: "plansPage.perMonth",
  quarterly: "plansPage.perQuarter",
  yearly: "plansPage.perYear",
};

// Под разделителем показываем те же три возможности, что и карточки планов в
// приложении; недостающие в БД строки рендерятся приглушённо с «—».
const CARD_FEATURES = [
  "Поддержка",
  "Сохранение реквизитов",
  "Проверка документов",
];
const NOT_INCLUDED = "—";

function quotaText(n: number): string {
  return n === -1 ? "∞" : String(n);
}

export function PlansPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const trpc = useTRPC();
  const [period, setPeriod] = useState<PeriodKey>("monthly");

  const { data: plans = [], isLoading } = useQuery(
    trpc.subscriptions.plansPublic.queryOptions()
  );

  const goToPlans = () => {
    if (session) {
      navigate({ to: "/profile" });
      return;
    }
    navigate({ to: "/register" });
  };

  const cards = plans.map((p: DbPlan) => {
    const isFree = p.priceMonthly === 0;
    const amount = priceForPeriod(p, period);
    return {
      id: p.id,
      name: p.name,
      discount: p.discountLabel ?? undefined,
      description: p.description,
      price: isFree
        ? t("plansPage.free")
        : `${amount.toLocaleString("ru-RU")} ₸`,
      period: isFree ? undefined : t(PERIOD_SUFFIX_KEYS[period]),
      cta: t("landing.hero.start"),
      current: false,
      quotas: [
        { label: t("plansPage.download"), value: quotaText(p.downloadQuota) },
        { label: t("plansPage.edit"), value: quotaText(p.editQuota) },
      ],
      features: CARD_FEATURES.map(
        (label) =>
          (p.features ?? []).find((f) => f.label === label) ?? {
            label,
            value: NOT_INCLUDED,
          }
      ),
    };
  });

  return (
    <div
      className="min-h-svh font-landing"
      style={{ backgroundColor: PAGE_BG }}
    >
      <PublicNavbar scrolledClassName="bg-[#faf9f6]/90 backdrop-blur-md" />
      <main className="mx-auto flex max-w-[1200px] flex-col items-center gap-8 px-4 pt-6 pb-16 sm:px-6">
        <h1 className="whitespace-pre-line text-center font-semibold text-[32px] text-black leading-10 sm:text-[40px] sm:leading-[48px]">
          {t("plansPage.title")}
        </h1>

        {/* Переключатель периода — пилюли, активная тёмная (как в макете). */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {PERIOD_OPTIONS.map((option) => {
            const isActive = option.key === period;
            return (
              <button
                className={cn(
                  "rounded-lg px-3 py-1.5 font-medium text-sm transition-colors",
                  isActive
                    ? "bg-[#1b1b1b] text-[#faf9f6]"
                    : "border border-[#d4d4d4] text-[#1b1b1b] hover:bg-black/5"
                )}
                key={option.key}
                onClick={() => setPeriod(option.key)}
                type="button"
              >
                {t(option.labelKey)}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
            {t("templates.loading")}
          </div>
        ) : (
          <div className="grid w-full grid-cols-1 gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <PlanCard key={card.id} onSelect={goToPlans} plan={card} />
            ))}
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
