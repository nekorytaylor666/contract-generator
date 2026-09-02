import {
  CATEGORY_LABEL_BY_SLUG,
  DOCUMENT_TYPE_LABELS,
  resolveLocalized,
} from "@contract-builder/api/constants/template-options";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, CircleAlert, Download, Pencil, X } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  showActions = true,
}: {
  templateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Кнопки «Скачать»/«Редактировать» ведут через гейт страницы шаблона и
   * СОЗДАЮТ новый черновик. Из конструктора и карточки документа (где договор
   * уже есть) их прячем — иначе клик форкает дубликат и списывает квоту.
   */
  showActions?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const trpc = useTRPC();

  const { data: template, isLoading } = useQuery({
    ...trpc.templates.getById.queryOptions({ id: templateId }),
    enabled: open,
  });

  // Оба действия идут через гейт-модалки страницы шаблона (цена/квота/оплата),
  // как в меню «…» карточки каталога: прямой вызов downloadPurchased и прямой
  // переход в конструктор отсюда позволяли скачивать и редактировать в обход
  // оплаты и квот.
  const goToAction = (action: "edit" | "download") => {
    onOpenChange(false);
    navigate({
      to: "/templates/$templateId",
      params: { templateId },
      search: { action },
    });
  };

  // Клик по связанному договору ведёт на его страницу шаблона.
  const goToRelated = (relatedId: string) => {
    onOpenChange(false);
    navigate({
      to: "/templates/$templateId",
      params: { templateId: relatedId },
    });
  };

  // Связанные договоры, подобранные админом (getById отдаёт только
  // опубликованные, в заданном порядке).
  const relatedTemplates = template?.relatedTemplates ?? [];

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
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-[480px]"
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 flex-row items-center justify-between border-border border-b p-4">
          <DialogTitle className="text-base">О договоре</DialogTitle>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted"
          >
            <X className="size-4" />
          </DialogClose>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
          {isLoading || !localized ? (
            <p className="py-6 text-center text-muted-foreground text-sm">
              Загрузка…
            </p>
          ) : (
            <>
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
              {relatedTemplates.length > 0 && (
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-[16px] text-black leading-5">
                    {t("templates.related")}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {relatedTemplates.map((item) => {
                      const itemLocalized = resolveLocalized(
                        {
                          title: item.title,
                          description: item.description,
                          typstContent: "",
                        },
                        item.localizedContent,
                        i18n.language
                      );
                      return (
                        <button
                          className="flex w-full items-center gap-4 rounded-lg border border-[#e5e5e5] p-4 text-left transition-colors hover:border-foreground/30"
                          key={item.id}
                          onClick={() => goToRelated(item.id)}
                          type="button"
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="font-medium text-[14px] text-foreground leading-[18px]">
                              {itemLocalized.title}
                            </span>
                            {itemLocalized.description && (
                              <span className="font-medium text-[14px] text-muted-foreground leading-[18px]">
                                {itemLocalized.description}
                              </span>
                            )}
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {showActions && (
          <DialogFooter className="shrink-0 border-border border-t p-4">
            <Button
              className="border-[#d4d4d4]"
              onClick={() => goToAction("download")}
              type="button"
              variant="outline"
            >
              <Download className="size-4" />
              {t("templates.download")}
            </Button>
            <Button onClick={() => goToAction("edit")} type="button">
              <Pencil className="size-4" />
              {t("templates.edit")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
