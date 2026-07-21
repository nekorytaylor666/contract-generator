import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  History,
  type LucideIcon,
  PenOff,
  Search,
  Send,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Статусы документа (см. Figma «08_Documents/Изменение статуса карточек»).
 * Первые четыре пользователь ставит вручную из меню карточки; «расторгнут» и
 * «ожидает подписи» зарезервированы под будущий флоу подписания.
 */
export type DocumentStatus =
  | "draft"
  | "in_progress"
  | "signed"
  | "expired"
  | "terminated"
  | "awaiting_signature";

// Порядок пунктов в меню «Поменять статус» — как в макете.
export const SETTABLE_STATUSES = [
  "signed",
  "in_progress",
  "draft",
  "expired",
] as const;

const STATUS_META: Record<
  DocumentStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  signed: {
    label: "Подписан",
    icon: CircleCheck,
    className: "bg-[#e5f3e6] text-[#2e6b2e]",
  },
  in_progress: {
    label: "В процессе",
    icon: Search,
    className: "bg-[#fdf3d7] text-[#b07d15]",
  },
  draft: {
    label: "Черновик",
    icon: CircleDashed,
    className: "bg-muted text-muted-foreground",
  },
  expired: {
    label: "Истёк",
    icon: CircleAlert,
    className: "bg-[#fde7e7] text-[#c04545]",
  },
  terminated: {
    label: "Расторгнут",
    icon: PenOff,
    className: "bg-[#ece5f6] text-[#7a5ea6]",
  },
  awaiting_signature: {
    label: "Ожидает подписи",
    icon: Send,
    className: "bg-[#1d4f6e] text-white",
  },
};

/** Неизвестные/старые значения из БД показываем как черновик. */
export function normalizeDocumentStatus(raw: string): DocumentStatus {
  return raw in STATUS_META ? (raw as DocumentStatus) : "draft";
}

export function documentStatusLabel(status: string): string {
  return STATUS_META[normalizeDocumentStatus(status)].label;
}

export function DocumentStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[normalizeDocumentStatus(status)];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 font-medium text-xs",
        meta.className
      )}
    >
      <Icon className="size-3.5" />
      {meta.label}
    </span>
  );
}

const MONTHS_RU_GENITIVE = [
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
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDocumentDate(value: Date | string): string {
  const date = new Date(value);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(new Date()) - startOfDay(date)) / MILLIS_PER_DAY
  );
  if (diffDays <= 0) {
    return "Сегодня";
  }
  if (diffDays === 1) {
    return "Вчера";
  }
  return `${date.getDate()} ${MONTHS_RU_GENITIVE[date.getMonth()]}`;
}

/** Чип с датой последнего изменения — рядом с бейджем статуса. */
export function DocumentDateChip({ value }: { value: Date | string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-muted-foreground text-xs">
      <History className="size-3.5" />
      {formatDocumentDate(value)}
    </span>
  );
}
