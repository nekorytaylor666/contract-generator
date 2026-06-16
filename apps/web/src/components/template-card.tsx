import { Link } from "@tanstack/react-router";
import { FileText, type LucideIcon, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import type { TemplateVariable } from "@/routes/templates/index";

interface TemplateCardProps {
  id: string;
  title: string;
  description?: string | null;
  categoryLabel?: string;
  categoryIcon?: LucideIcon;
  variables?: TemplateVariable[];
  /** Price in whole tenge (0 = free). */
  price?: number;
  purchased?: boolean;
}

// "4 999 ₸" — space-grouped tenge, matching the Figma catalogue card.
function formatPrice(tenge: number): string {
  return `${tenge.toLocaleString("ru-RU")} ₸`;
}

export function TemplateCard({
  id,
  title,
  description,
  categoryLabel,
  categoryIcon: CategoryIcon = FileText,
  price = 0,
  purchased = false,
}: TemplateCardProps) {
  const { t } = useTranslation();
  const isPaid = price > 0;

  return (
    <Link
      className="group flex h-full flex-col justify-between rounded-2xl border border-[#ececec] p-5 transition-colors hover:border-foreground/30"
      params={{ templateId: id }}
      to="/templates/$templateId"
    >
      <div className="flex w-full flex-col gap-4">
        {/* card-top: category + actions */}
        <div className="flex h-6 items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <CategoryIcon className="size-4 shrink-0 text-foreground" />
            <span className="truncate font-medium text-[14px] text-foreground leading-[18px]">
              {categoryLabel ?? "—"}
            </span>
          </div>
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </span>
        </div>

        {/* card-text: title + description */}
        <div className="flex flex-col gap-2">
          <h3 className="line-clamp-2 h-11 font-semibold text-[16px] text-black leading-5">
            {title}
          </h3>
          {description && (
            <p className="line-clamp-3 font-medium text-[14px] text-muted-foreground leading-[18px]">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* card-attributes: price */}
      <div className="flex items-center justify-between gap-2 pt-4">
        <span className="truncate font-medium text-[14px] text-foreground leading-[18px]">
          {isPaid ? formatPrice(price) : t("templates.free")}
        </span>
        {isPaid && purchased && (
          <Badge className="border-green-200 bg-green-50 text-green-700">
            {t("templates.purchased")}
          </Badge>
        )}
      </div>
    </Link>
  );
}
