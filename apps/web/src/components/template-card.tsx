import { Link } from "@tanstack/react-router";
import {
  House,
  type LucideIcon,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";

import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import type { TemplateVariable } from "@/routes/templates/index";

interface TemplateCardProps {
  id: string;
  title: string;
  description?: string | null;
  createdAt?: Date | string;
  categoryLabel?: string;
  categoryIcon?: LucideIcon;
  variables?: TemplateVariable[];
  /** Price in minor units (0 = free). */
  price?: number;
  purchased?: boolean;
  isPurchasing?: boolean;
  onPay?: () => void;
}

function formatPrice(minorUnits: number): string {
  const major = (minorUnits / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${major} ₽`;
}

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function formatMonthYear(date?: Date | string): string {
  if (!date) {
    return "Недавно";
  }
  const d = new Date(date);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function TemplateCard({
  id,
  title,
  description,
  createdAt,
  categoryLabel = "Недвижимость",
  categoryIcon: CategoryIcon = House,
  price = 0,
  purchased = false,
  isPurchasing = false,
  onPay,
}: TemplateCardProps) {
  const { t } = useTranslation();

  return (
    <Link
      className="group block h-full"
      params={{ templateId: id }}
      to="/templates/$templateId"
    >
      <div className="flex h-full flex-col justify-between rounded-2xl border border-[#ececec] p-5 transition-colors hover:border-foreground/30">
        <div className="flex flex-col gap-4">
          <div className="flex h-6 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="size-4 text-foreground" />
              <span className="truncate text-foreground text-sm">
                {formatMonthYear(createdAt)}
              </span>
            </div>
            <button
              aria-label="Действия"
              className="flex size-6 items-center justify-center text-foreground"
              onClick={(e) => e.preventDefault()}
              type="button"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="line-clamp-2 h-11 font-semibold text-[16px] text-black leading-5">
              {title}
            </h3>
            {description && (
              <p className="line-clamp-3 text-[14px] text-muted-foreground leading-[18px]">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <CategoryIcon className="size-4 text-foreground" />
            <span className="truncate text-[14px] text-foreground">
              {categoryLabel}
            </span>
          </div>
          {price > 0 &&
            (purchased ? (
              <Badge className="border-green-200 bg-green-50 text-green-700">
                {t("templates.purchased")}
              </Badge>
            ) : (
              <button
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-60"
                disabled={isPurchasing}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPay?.();
                }}
                type="button"
              >
                {isPurchasing
                  ? "..."
                  : t("templates.pay", { amount: formatPrice(price) })}
              </button>
            ))}
        </div>
      </div>
    </Link>
  );
}
