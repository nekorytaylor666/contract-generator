import {
  CATEGORY_LABEL_BY_SLUG,
  DOCUMENT_TYPE_LABELS,
  resolveLocalized,
} from "@contract-builder/api/constants/template-options";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert, Download, Pencil, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/utils/trpc";

// «Март 2025» — capitalized month + year. ru-RU с year:"numeric" добавляет
// суффикс « г.», которого нет в макете, поэтому собираем строку вручную.
export function formatUpdated(value: Date | string): string {
  const date = new Date(value);
  const month = new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(
    date
  );
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
}

/**
 * Модальное окно «О договоре» с карточки шаблона: название, описание, теги
 * (тип документа + категории), строка об обновлении и действия «Скачать» /
 * «Редактировать». Полные данные тянет по getById при открытии.
 */
export function TemplateInfoDialog({
  templateId,
  open,
  onOpenChange,
}: {
  templateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const trpc = useTRPC();

  const { data: template, isLoading } = useQuery({
    ...trpc.templates.getById.queryOptions({ id: templateId }),
    enabled: open,
  });

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

  const localized = template
    ? resolveLocalized(
        {
          title: template.title,
          description: template.description,
          typstContent: template.typstContent,
        },
        template.localizedContent,
        i18n.language
      )
    : null;

  // Теги = тип документа + категории (человекочитаемые ярлыки), как в
  // инфо-панели страницы шаблона.
  const tags: string[] = [];
  if (template) {
    const docTypeLabel = template.documentType
      ? (DOCUMENT_TYPE_LABELS as Record<string, string>)[template.documentType]
      : undefined;
    if (docTypeLabel) {
      tags.push(docTypeLabel);
    }
    for (const slug of template.categories ?? []) {
      const label = CATEGORY_LABEL_BY_SLUG[slug];
      if (label) {
        tags.push(label);
      }
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="gap-0 p-0 sm:max-w-[480px]"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between border-border border-b p-4">
          <DialogTitle className="text-base">О договоре</DialogTitle>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted"
          >
            <X className="size-4" />
          </DialogClose>
        </DialogHeader>

        <div className="flex flex-col gap-6 p-4">
          {isLoading || !localized ? (
            <p className="py-6 text-center text-muted-foreground text-sm">
              Загрузка…
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <h2 className="font-semibold text-black text-xl leading-6">
                {localized.title}
              </h2>
              {localized.description && (
                <p className="text-muted-foreground text-sm leading-[18px]">
                  {localized.description}
                </p>
              )}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      className="rounded-full border border-[#d4d4d4] px-2 py-1 font-medium text-[14px] text-foreground leading-[18px]"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {template?.updatedAt && (
                <div className="flex items-start gap-3">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm leading-[18px]">
                    Обновлено — {formatUpdated(template.updatedAt)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-border border-t p-4">
          <Button
            className="border-[#d4d4d4]"
            disabled={downloadMutation.isPending}
            onClick={() =>
              downloadMutation.mutate({
                templateId,
                locale: i18n.language,
              })
            }
            type="button"
            variant="outline"
          >
            <Download className="size-4" />
            {t("templates.download")}
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate({
                to: "/templates/$templateId/builder",
                params: { templateId },
              });
            }}
            type="button"
          >
            <Pencil className="size-4" />
            {t("templates.edit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
