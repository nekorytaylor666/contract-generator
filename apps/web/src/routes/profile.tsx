import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Download,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { requireAuth } from "@/lib/auth-guard";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  beforeLoad: async () => {
    const { session, organizations } = await requireAuth();
    return { session, organizations };
  },
});

const PERIODS = [
  "Ежемесячно",
  "Ежеквартально (- 7%)",
  "Ежегодно (-22%)",
] as const;

type ProfileTab = "personal" | "security" | "requisites" | "subscription";

const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: "personal", label: "Личные данные" },
  { id: "security", label: "Безопасность" },
  { id: "requisites", label: "Реквизиты" },
  { id: "subscription", label: "Подписка" },
];

interface Feature {
  label: string;
  value: string;
}

interface Plan {
  id: string;
  name: string;
  discount?: string;
  description: string;
  price: string;
  period?: string;
  cta: string;
  current: boolean;
  // Always-included usage quotas (shown above the divider).
  quotas: Feature[];
  // Per-plan capabilities (shown below the divider). value === NOT_INCLUDED
  // renders muted with an "x" icon.
  features: Feature[];
}

const NOT_INCLUDED = "—";

function FeatureRow({ label, value }: Feature) {
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

function PlanCard({
  plan,
  onSelect,
  loading,
}: {
  plan: Plan;
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

interface DbPlan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  discountLabel: string | null;
  downloadQuota: number;
  editQuota: number;
  features: Feature[];
}

function quotaText(n: number): string {
  return n === -1 ? "∞" : String(n);
}

function dbPlanToCard(p: DbPlan, currentPlanId: string | null): Plan {
  const isFree = p.priceMonthly === 0;
  return {
    id: p.id,
    name: p.name,
    discount: p.discountLabel ?? undefined,
    description: p.description,
    price: isFree ? "Бесплатно" : `${p.priceMonthly.toLocaleString("ru-RU")} ₸`,
    period: isFree ? undefined : "/ в месяц",
    cta: p.id === currentPlanId ? "Ваш тариф" : `Перейти на ${p.name}`,
    current: p.id === currentPlanId,
    quotas: [
      { label: "Скачивание", value: quotaText(p.downloadQuota) },
      { label: "Редактирование", value: quotaText(p.editQuota) },
    ],
    features: p.features ?? [],
  };
}

function SubscriptionTab() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(PERIODS[0]);
  const trpc = useTRPC();
  const { data: dbPlans = [] } = useQuery(
    trpc.subscriptions.plans.queryOptions()
  );
  const { data: my } = useQuery(
    trpc.subscriptions.mySubscription.queryOptions()
  );
  const typedPlans = dbPlans as DbPlan[];
  const plans = typedPlans.map((p) => dbPlanToCard(p, my?.planId ?? null));

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
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-2xl text-foreground leading-6">
          Доступные планы
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-foreground text-xs">Период подписки</span>
          <div className="flex items-center gap-1 rounded-[10px] bg-muted p-1">
            {PERIODS.map((option) => {
              const isActive = option === period;
              return (
                <button
                  className={cn(
                    "rounded-lg px-2 py-1 text-xs transition-colors",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "border border-border text-foreground hover:bg-background/60"
                  )}
                  key={option}
                  onClick={() => setPeriod(option)}
                  type="button"
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {my?.planName && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-foreground text-sm">
          Текущий тариф: <span className="font-medium">{my.planName}</span>. В
          этом месяце осталось — скачивания:{" "}
          {my.downloadRemaining === -1 ? "∞" : my.downloadRemaining},
          редактирования: {my.editRemaining === -1 ? "∞" : my.editRemaining}.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan, i) => {
          const isFree = typedPlans[i].priceMonthly === 0;
          const canBuy = !(plan.current || isFree);
          return (
            <PlanCard
              key={plan.id}
              loading={
                checkout.isPending && checkout.variables?.planId === plan.id
              }
              onSelect={
                canBuy
                  ? () =>
                      checkout.mutate({ planId: plan.id, period: "monthly" })
                  : undefined
              }
              plan={plan}
            />
          );
        })}
      </div>
    </section>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="font-medium text-foreground text-sm">{title}</p>
      <p className="mt-1 text-muted-foreground text-xs">
        Раздел скоро появится
      </p>
    </div>
  );
}

interface Requisite {
  id: string;
  name: string;
  inn: string;
  address: string;
  phone: string;
  email: string;
}

// Static placeholder rows. No DB yet — wire to real data later.
const REQUISITES_SAMPLE: Requisite[] = [
  {
    id: "1",
    name: "ИП Сейткали А.Б.",
    inn: "890514300127",
    address: "г. Астана, пр. Республики, 4…",
    phone: "+7 702 345 67 89",
    email: "setkali@mail.ru",
  },
  {
    id: "2",
    name: "ТОО «Meridian Legal»",
    inn: "210640013872",
    address: "г. Алматы, ул. Панфилова, 98",
    phone: "+7 727 300 11 22",
    email: "contact@meridian.kz",
  },
  {
    id: "3",
    name: "Джаксыбеков Нурлан Сери…",
    inn: "951203401256",
    address: "г. Шымкент, ул. Байтурсыно…",
    phone: "+7 747 456 78 90",
    email: "n.dzhaksybekov@gmail.com",
  },
  {
    id: "4",
    name: "ИП Воронова М.С.",
    inn: "880726350089",
    address: "г. Алматы, мкр. Самал-2, д. 33",
    phone: "+7 705 567 89 01",
    email: "voronova.ms@yandex.ru",
  },
  {
    id: "5",
    name: "АО «Halyk Finance»",
    inn: "030540002315",
    address: "г. Алматы, пр. Аль-Фараби,…",
    phone: "+7 727 259 04 44",
    email: "legal@halykfinance.kz",
  },
  {
    id: "6",
    name: "ТОО «Digitas KZ»",
    inn: "190740018834",
    address: "г. Астана, ул. Сыганак, 14, оф…",
    phone: "+7 717 200 33 44",
    email: "hello@digitas.kz",
  },
  {
    id: "7",
    name: "ИП Ли Дмитрий Александр…",
    inn: "910330200467",
    address: "г. Алматы, ул. Гоголя, 67, кв. 4",
    phone: "+7 708 678 90 12",
    email: "d.lee.kz@gmail.com",
  },
  {
    id: "8",
    name: "ТОО «АгроПартнёр»",
    inn: "150840025631",
    address: "г. Костанай, ул. Тарана, 112",
    phone: "+7 714 252 18 90",
    email: "agro@partner.kz",
  },
  {
    id: "9",
    name: "Мусина Айгерим Талгатовна",
    inn: "000915401389",
    address: "г. Алматы, ул. Достык, 200, к…",
    phone: "+7 775 789 01 23",
    email: "aigerimusina@mail.ru",
  },
];

function RequisitesTab() {
  return (
    <section className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-semibold text-base text-foreground leading-5">
            Реквизиты
          </h2>
          <p className="text-base text-muted-foreground leading-5">
            Ваши реквизиты, которые отображаются в договорах.
          </p>
        </div>
        <Button
          className="bg-foreground text-background text-sm hover:bg-foreground/90"
          size="lg"
        >
          <Plus className="size-4" />
          Добавить реквизиты
        </Button>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="relative w-[320px]">
            <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 rounded-lg border-[#e5e5e5] pl-8 text-sm"
              placeholder="Введите наименование или БИН"
            />
          </div>
          <Button
            className="border-[#d4d4d4] bg-transparent text-foreground text-sm"
            size="lg"
            variant="outline"
          >
            <Filter className="size-4" />
            Фильтры
          </Button>
        </div>
        <Button
          className="border-[#d4d4d4] bg-transparent text-foreground text-sm"
          size="lg"
          variant="outline"
        >
          <Download className="size-4" />
          Экспортировать в CSV
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-border border-b bg-muted/40 text-left">
            <tr>
              <th className="w-10 px-3 py-3" scope="col">
                <Checkbox aria-label="Выбрать все" />
              </th>
              <th className="px-3 py-3 font-medium text-foreground" scope="col">
                Наименование
              </th>
              <th className="px-3 py-3 font-medium text-foreground" scope="col">
                ИИН/БИН
              </th>
              <th className="px-3 py-3 font-medium text-foreground" scope="col">
                Юридический адрес
              </th>
              <th className="px-3 py-3 font-medium text-foreground" scope="col">
                Номер телефона
              </th>
              <th className="px-3 py-3 font-medium text-foreground" scope="col">
                Электронная почта
              </th>
              <th className="w-14 px-3 py-3" scope="col" />
            </tr>
          </thead>
          <tbody>
            {REQUISITES_SAMPLE.map((row) => (
              <tr
                className="border-border border-b last:border-b-0 hover:bg-muted/30"
                key={row.id}
              >
                <td className="px-3 py-3">
                  <Checkbox aria-label={`Выбрать ${row.name}`} />
                </td>
                <td className="px-3 py-3 text-foreground">{row.name}</td>
                <td className="px-3 py-3 text-foreground">{row.inn}</td>
                <td className="px-3 py-3 text-foreground">{row.address}</td>
                <td className="px-3 py-3 text-foreground">{row.phone}</td>
                <td className="px-3 py-3">
                  <a
                    className="text-foreground underline"
                    href={`mailto:${row.email}`}
                  >
                    {row.email}
                  </a>
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    aria-label="Действия"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    type="button"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function SecurityTab() {
  return (
    <section className="flex flex-col divide-y divide-border">
      <SecurityRow
        action={
          <>
            <button
              className="px-2 text-foreground text-sm hover:underline"
              type="button"
            >
              Забыли пароль?
            </button>
            <Button
              className="border-[#d4d4d4] bg-transparent text-foreground text-sm"
              size="lg"
              variant="outline"
            >
              Изменить пароль
            </Button>
          </>
        }
        subtitle="********"
        title="Пароль"
      />
      <SecurityRow
        action={
          <Button
            className="border-[#d4d4d4] bg-transparent text-foreground text-sm"
            size="lg"
            variant="outline"
          >
            Подключить Google
          </Button>
        }
        subtitle="Выключена"
        title="Авторизация через Google"
      />
      <SecurityRow
        action={
          <Button
            className="border-[#d4d4d4] bg-transparent text-foreground text-sm"
            size="lg"
            variant="outline"
          >
            Включить
          </Button>
        }
        subtitle="Выключена"
        title="Двухфакторная аутентификация"
      />
    </section>
  );
}

function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("subscription");

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex flex-col">
        {/* Navigation: heading + tab bar */}
        <div className="flex flex-col gap-4 px-6 pt-4">
          <h1 className="font-semibold text-2xl text-foreground leading-7">
            Профиль
          </h1>
          <div className="flex items-start gap-1 border-border border-b">
            {PROFILE_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  className={cn(
                    "-mb-px flex flex-col items-stretch border-b pb-2 transition-colors",
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
        <div className="px-6 py-4">
          {activeTab === "subscription" && <SubscriptionTab />}
          {activeTab === "personal" && <PlaceholderTab title="Личные данные" />}
          {activeTab === "security" && <SecurityTab />}
          {activeTab === "requisites" && <RequisitesTab />}
        </div>
      </div>
    </div>
  );
}
