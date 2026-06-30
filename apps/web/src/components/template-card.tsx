import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bookmark,
  Download,
  FileText,
  type LucideIcon,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TemplateVariable } from "@/routes/templates/index";
import { useTRPC } from "@/utils/trpc";

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
  /** Whether the current user has bookmarked this template. */
  saved?: boolean;
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
  saved = false,
}: TemplateCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isPaid = price > 0;

  const bookmarkMutation = useMutation(
    trpc.templates.toggleBookmark.mutationOptions({
      onSuccess: (res) => {
        queryClient.invalidateQueries({
          queryKey: trpc.templates.myBookmarks.queryKey(),
        });
        toast.success(res.saved ? "Шаблон сохранён" : "Убрано из сохранённых");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const downloadMutation = useMutation(
    trpc.templates.downloadPurchased.mutationOptions({
      onSuccess: (result) => {
        const link = document.createElement("a");
        link.href = result.dataUrl;
        link.download = result.fileName;
        link.click();
      },
      onError: (err) => toast.error(err.message),
    })
  );

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
          <div className="flex items-center gap-0.5">
            {/* Saved marker — filled when bookmarked; click toggles. */}
            <button
              aria-label={saved ? "Убрать из сохранённых" : "Сохранить шаблон"}
              className="flex size-6 items-center justify-center rounded-md outline-none hover:bg-muted"
              disabled={bookmarkMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                bookmarkMutation.mutate({ templateId: id });
              }}
              type="button"
            >
              <Bookmark
                className={cn(
                  "size-4",
                  saved ? "fill-primary text-primary" : "text-muted-foreground"
                )}
              />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Действия с шаблоном"
                className="flex size-6 items-center justify-center rounded-md text-foreground outline-none hover:bg-muted"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem
                  onSelect={() =>
                    navigate({
                      to: "/templates/$templateId/builder",
                      params: { templateId: id },
                    })
                  }
                >
                  <Pencil className="size-4" />
                  {t("templates.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={downloadMutation.isPending}
                  onSelect={() =>
                    downloadMutation.mutate({
                      templateId: id,
                      locale: i18n.language,
                    })
                  }
                >
                  <Download className="size-4" />
                  {t("templates.download")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={bookmarkMutation.isPending}
                  onSelect={() => bookmarkMutation.mutate({ templateId: id })}
                >
                  <Bookmark className={cn("size-4", saved && "fill-current")} />
                  {saved ? "Убрать из сохранённых" : t("templates.bookmark")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
