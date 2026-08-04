import { Check, Download, Loader2, PenLine, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

// Общие детали модалок страницы шаблона («Скачать договор», «Редактирование
// договора»): кнопки, статусные экраны платёжного флоу и утилиты Робокассы.

export const MODAL_POLL_INTERVAL_MS = 2000;

export const PRIMARY_BUTTON_CLASS =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg bg-[#171717] px-4 font-medium text-[#fafafa] text-sm transition-colors hover:bg-[#171717]/90 disabled:opacity-50";
export const OUTLINE_BUTTON_CLASS =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#d4d4d4] px-4 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-60";

// Ссылка Robokassa содержит InvId создаваемого платежа — запоминаем его,
// чтобы страница возврата отличала «наш» платёж от постороннего.
export function parseInvIdFromPaymentUrl(url: string): number | null {
  try {
    const raw = new URL(url).searchParams.get("InvId");
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

// «4 999 ₸» — как на карточках каталога.
export function formatTenge(tenge: number): string {
  return `${tenge.toLocaleString("ru-RU")} ₸`;
}

/** Строка «ключ — значение» в сводке модалки (Стоимость / Скачивание /
 * Редактирование / Итого): подпись слева серым, значение справа без переноса —
 * длинный счётчик («43 редактирования из 50») не ломает строку. Если места
 * совсем нет, ужимается подпись (многоточием), а не значение. */
export function InfoRow({
  label,
  value,
  valueClassName,
  withBottomBorder,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  withBottomBorder?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-[#f5f5f5] border-t py-3",
        withBottomBorder && "border-b"
      )}
    >
      <span className="min-w-0 truncate font-medium text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 whitespace-nowrap text-right font-medium text-foreground",
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Карточка-«радио» (разовая покупка / повышение тарифа, выбор тарифа). */
export function ChoiceCard({
  title,
  hint,
  selected,
  onSelect,
}: {
  title: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "flex w-full gap-3 rounded-[10px] border p-3 text-left transition-colors",
        selected ? "border-[#9e1f5a]" : "border-[#e5e5e5] hover:bg-muted/40"
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-[#d4d4d4]">
        {selected && <span className="size-2 rounded-full bg-[#9e1f5a]" />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground text-sm leading-[18px]">
          {title}
        </span>
        <span className="text-muted-foreground text-xs leading-4">{hint}</span>
      </span>
    </button>
  );
}

export interface PlanOption {
  id: string;
  name: string;
  downloadQuota: number;
  editQuota: number;
}

/** Шаг выбора нового тарифа при повышении — общий для модалок скачивания и
 * редактирования (заголовок «Выберите новый тариф», стопка карточек-радио,
 * футер «Назад» + «Продолжить»). */
export function PlansStep({
  options,
  choice,
  onChoose,
  onBack,
  onContinue,
  busy,
}: {
  options: PlanOption[];
  choice: string | null;
  onChoose: (planId: string) => void;
  onBack: () => void;
  onContinue: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();

  const planLabel = (plan: PlanOption) => {
    const downloads =
      plan.downloadQuota === -1
        ? t("downloadDialog.planDownloadsUnlimited")
        : t("downloadDialog.planDownloads", { count: plan.downloadQuota });
    const edits =
      plan.editQuota === -1
        ? t("downloadDialog.planEditsUnlimited")
        : t("downloadDialog.planEdits", { count: plan.editQuota });
    return `${downloads} · ${edits}`;
  };

  return (
    <>
      <div className="flex flex-col gap-3 px-4 py-2">
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold text-foreground text-xl leading-6">
            {t("downloadDialog.choosePlan")}
          </h2>
          <p className="text-muted-foreground text-sm leading-[18px]">
            {t("downloadDialog.choosePlanHint")}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {options.map((plan) => (
            <ChoiceCard
              hint={planLabel(plan)}
              key={plan.id}
              onSelect={() => onChoose(plan.id)}
              selected={choice === plan.id}
              title={plan.name}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 p-4">
        <button
          className={OUTLINE_BUTTON_CLASS}
          disabled={busy}
          onClick={onBack}
          type="button"
        >
          {t("downloadDialog.back")}
        </button>
        <button
          className={PRIMARY_BUTTON_CLASS}
          disabled={choice === null || busy}
          onClick={onContinue}
          type="button"
        >
          {t("downloadDialog.continue")}
        </button>
      </div>
    </>
  );
}

// Иконка и цвета круга-иллюстрации для платёжных статусов — по макету.
export type StatusTone = "redirect" | "checking" | "failed" | "success";

const STATUS_CIRCLE: Record<StatusTone, string> = {
  redirect: "bg-[#f3f4f6]",
  checking: "bg-[#fef9c3]",
  failed: "bg-[#ffe2e2]",
  success: "bg-[#dcfce7]",
};

function StatusIcon({ tone }: { tone: StatusTone }) {
  if (tone === "failed") {
    return <X className="size-6 text-[#7f1d1d]" />;
  }
  if (tone === "success") {
    return <Check className="size-6 text-[#14532d]" />;
  }
  return (
    <Loader2
      className={cn(
        "size-6 animate-spin",
        tone === "checking" ? "text-[#854d0e]" : "text-muted-foreground"
      )}
    />
  );
}

/** Центрированный статусный экран: круг-иллюстрация, заголовок, подпись и
 * необязательная кнопка действия. */
export function StatusView({
  tone,
  title,
  hint,
  action,
}: {
  tone: StatusTone;
  title: string;
  hint: string;
  action?: {
    label: string;
    icon?: "download" | "edit";
    disabled?: boolean;
    onClick: () => void;
  };
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
      <div
        className={cn(
          "flex size-16 items-center justify-center rounded-full",
          STATUS_CIRCLE[tone]
        )}
      >
        <StatusIcon tone={tone} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-medium text-foreground text-sm leading-[18px]">
          {title}
        </p>
        <p className="mx-auto max-w-[240px] text-muted-foreground text-sm leading-[18px]">
          {hint}
        </p>
      </div>
      {action && (
        <button
          className={OUTLINE_BUTTON_CLASS}
          disabled={action.disabled}
          onClick={action.onClick}
          type="button"
        >
          {action.icon === "download" && <Download className="size-4" />}
          {action.icon === "edit" && <PenLine className="size-4" />}
          {action.label}
        </button>
      )}
    </div>
  );
}
