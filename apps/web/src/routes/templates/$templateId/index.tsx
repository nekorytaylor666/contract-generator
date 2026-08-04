import {
  CATEGORY_LABEL_BY_SLUG,
  DOCUMENT_TYPE_LABELS,
  resolveLocalized,
  resolveLocalizedVariables,
} from "@contract-builder/api/constants/template-options";
import { env } from "@contract-builder/env/web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bookmark,
  CircleAlert,
  Download,
  FileText,
  FolderOpen,
  PenLine,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { LanguageSwitcher } from "@/components/language-switcher";
import { HeaderSignOut } from "@/components/sidebar-layout";
import { InteractiveDocumentPreview } from "@/components/template-builder/interactive-document-preview";
import { NativeInlinePreview } from "@/components/template-builder/native-inline-preview";
import { isComplexNative } from "@/components/template-builder/server-typst-preview";
import { TemplateDownloadDialog } from "@/components/template-download-dialog";
import { TemplateEditDialog } from "@/components/template-edit-dialog";
import { requireAuth } from "@/lib/auth-guard";
import { type InitialPayment, readDownloadReturn } from "@/lib/download-return";
import { isNativeTypst } from "@/lib/native-typst";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";
import type { TemplateVariable } from "../";

// Same style preset the admin uses for in-app previews.
const PREVIEW_STYLE = { font: "", preset: "default" } as const;
const noopValueChange = () => undefined;

// Picks the right preview. Everything renders client-side (read-only): complex
// native templates go through the interpreter-backed inline preview, the rest
// through the interactive `{{var}}` parser. No server Typst compile here.
function PreviewBody({
  typstContent,
  previewValues,
  variables,
}: {
  typstContent: string | null | undefined;
  previewValues: Record<string, unknown>;
  variables: TemplateVariable[];
}) {
  if (!typstContent) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <FileText className="mx-auto size-16 text-muted-foreground/30" />
          <p className="mt-3 text-muted-foreground text-sm">
            У шаблона нет Typst-контента
          </p>
        </div>
      </div>
    );
  }
  // Complex native templates (#let functions, loops) render via the client
  // interpreter — same engine as the builder — instead of the server Typst
  // compiler, so a preview always shows even if the source has quirks the real
  // compiler rejects. Read-only here: value changes are a no-op.
  if (isNativeTypst(typstContent) && isComplexNative(typstContent)) {
    return (
      <NativeInlinePreview
        logo={null}
        onValueChange={noopValueChange}
        style={PREVIEW_STYLE}
        typstContent={typstContent}
        values={previewValues}
        variables={variables}
      />
    );
  }
  return (
    <InteractiveDocumentPreview
      logo={null}
      onValueChange={noopValueChange}
      style={PREVIEW_STYLE}
      typstContent={typstContent}
      values={previewValues}
      variables={variables}
    />
  );
}

// The preview slot shows a server-rendered "photo": a PNG of the document's
// first page with gray italic placeholder labels — the same look as the live
// preview, but pixel-identical to the downloaded PDF. If the server can't
// compile this template, falls back to the in-browser render.
function PreviewPane({
  templateId,
  photoVersion,
  previewLimited,
  paid,
  locale,
  typstContent,
  previewValues,
  variables,
}: {
  templateId: string;
  /** Changes on every template save — busts the browser's day-long image
   * cache (translation-only edits don't bump currentVersion, so we key on
   * updatedAt instead). */
  photoVersion: number;
  previewLimited: boolean;
  /** Paid templates always get the bottom-half blur, even for users with
   * full access — the photo is a teaser; work happens in the builder. */
  paid: boolean;
  locale: string;
  typstContent: string | null | undefined;
  previewValues: Record<string, unknown>;
  variables: TemplateVariable[];
}) {
  const [photoFailed, setPhotoFailed] = useState(false);

  let heightClass: string | undefined;
  if (previewLimited) {
    heightClass = "max-h-[460px]";
  } else if (photoFailed) {
    heightClass = "h-[80vh]";
  }

  const photoSrc = `${env.VITE_SERVER_URL}/templates/${templateId}/preview.png?locale=${locale}&v=${photoVersion}`;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-background",
        heightClass
      )}
    >
      {photoFailed ? (
        <PreviewBody
          previewValues={previewValues}
          typstContent={typstContent}
          variables={variables}
        />
      ) : (
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError only switches to the client-side fallback render
        <img
          alt="Предпросмотр договора"
          className="aspect-[210/297] w-full object-cover object-top"
          height={2245}
          onError={() => setPhotoFailed(true)}
          src={photoSrc}
          width={1587}
        />
      )}
      {/* The bottom half of the photo is blurred on paid templates; the top
          edge of the blur fades in so there's no hard seam. */}
      {paid && !photoFailed && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/2 backdrop-blur-[6px] [mask-image:linear-gradient(to_bottom,transparent,black_48px)]"
        />
      )}
    </div>
  );
}

// Right-hand info panel shown while browsing a template (bought or not). It
// sells the template — title, description, audience tags, how many fields it
// asks for, and when it was last updated — instead of dumping the raw field
// list, which means nothing to someone who hasn't opened the builder yet.
function TemplateInfoSidebar({
  title,
  description,
  categories,
  documentType,
  updatedAt,
  fieldCount,
}: {
  title: string;
  description?: string | null;
  categories: string[];
  documentType?: string | null;
  updatedAt: Date | string;
  fieldCount: number;
}) {
  const chips: string[] = [];
  const docTypeLabel = documentType
    ? (DOCUMENT_TYPE_LABELS as Record<string, string>)[documentType]
    : undefined;
  if (docTypeLabel) {
    chips.push(docTypeLabel);
  }
  for (const slug of categories) {
    const label = CATEGORY_LABEL_BY_SLUG[slug];
    if (label) {
      chips.push(label);
    }
  }
  const updatedLabel = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date(updatedAt));

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 border-border border-t bg-background p-4 sm:p-6 lg:w-[365px] lg:overflow-auto lg:border-t-0 lg:border-l">
      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-foreground text-xl leading-tight">
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              className="rounded-full border border-[#d4d4d4] px-2.5 py-1 text-foreground text-sm"
              key={chip}
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-foreground text-sm">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        {fieldCount} полей для заполнения
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground text-sm leading-snug">
          Обновлено — {updatedLabel}
        </p>
      </div>
    </aside>
  );
}

export const Route = createFileRoute("/templates/$templateId/")({
  component: RouteComponent,
  // ?payInvId / ?payFailed — возврат с оплаты Робокассы: модалка скачивания
  // открывается сразу в состоянии «Проверяем оплату» / «Не удалось провести
  // оплату» (см. TemplateDownloadDialog).
  validateSearch: (
    search: Record<string, unknown>
  ): { payInvId?: number; payFailed?: boolean } => {
    const result: { payInvId?: number; payFailed?: boolean } = {};
    const raw = search.payInvId;
    if (raw != null && raw !== "") {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) {
        result.payInvId = parsed;
      }
    }
    if (search.payFailed) {
      result.payFailed = true;
    }
    return result;
  },
  beforeLoad: async () => {
    const { session, organizations } = await requireAuth();
    return { session, organizations };
  },
});

function RouteComponent() {
  const { templateId } = Route.useParams();
  const trpc = useTRPC();
  const { t, i18n } = useTranslation();

  // Контекст возврата с оплаты фиксируем один раз при монтировании — search
  // сразу чистится (replace), чтобы обновление страницы не открывало модалку
  // заново. Какую модалку открыть (скачивание или редактирование), решаем по
  // сохранённой перед редиректом ветке (см. download-return.ts).
  const { payInvId, payFailed } = Route.useSearch();
  const [initialPayment] = useState<InitialPayment | null>(() =>
    payInvId != null || payFailed
      ? { invId: payInvId ?? null, failed: Boolean(payFailed) }
      : null
  );
  const [paymentTarget] = useState<"download" | "edit">(() =>
    readDownloadReturn()?.flow === "edit" ? "edit" : "download"
  );
  const [downloadOpen, setDownloadOpen] = useState(
    initialPayment != null && paymentTarget === "download"
  );
  const [editOpen, setEditOpen] = useState(
    initialPayment != null && paymentTarget === "edit"
  );

  const {
    data: template,
    isLoading,
    error,
  } = useQuery({
    ...trpc.templates.getById.queryOptions({ id: templateId }),
    // Admin edits must be visible on the next visit, not a staleTime later:
    // cached data still paints instantly, but every mount revalidates (which
    // also refreshes the ?v cache key of the photo). Focus refetch is forced
    // for the "edit as admin in one window, check as client in another" flow.
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });

  // Stable variables array per template load, resolved for the UI language —
  // a locale with its own typst carries its own variables.
  const variables = useMemo<TemplateVariable[]>(
    () =>
      resolveLocalizedVariables(
        (template?.variables ?? []) as TemplateVariable[],
        template?.localizedContent,
        i18n.language
      ),
    [template, i18n.language]
  );

  // Fill structural fields (select/boolean/number/date) with defaults so
  // conditional branches render; leave text/textarea empty so the gray
  // placeholder labels are visible. Mirrors the admin preview behavior.
  const previewValues = useMemo<Record<string, unknown>>(() => {
    const sample: Record<string, unknown> = {};
    for (const v of variables) {
      if (v.defaultValue !== undefined) {
        sample[v.name] = v.defaultValue;
        continue;
      }
      switch (v.type) {
        case "boolean":
          sample[v.name] = false;
          break;
        case "number":
          sample[v.name] = 1;
          break;
        case "date":
          sample[v.name] = new Date().toISOString().split("T")[0];
          break;
        case "select":
          sample[v.name] = v.options?.[0] ?? "";
          break;
        default:
          // text/textarea — leave undefined so placeholder shows
          break;
      }
    }
    return sample;
  }, [variables]);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Search-параметры возврата с оплаты одноразовые — сразу убираем их из URL.
  useEffect(() => {
    if (payInvId == null && !payFailed) {
      return;
    }
    navigate({
      to: "/templates/$templateId",
      params: { templateId },
      search: {},
      replace: true,
    });
  }, [payInvId, payFailed, navigate, templateId]);

  // Create the document up-front so it shows in "Мои документы" immediately,
  // then open the builder editing it (further changes update the same doc).
  const createDraftMutation = useMutation(
    trpc.documents.save.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.documents.list.queryKey(),
        });
        // Создание документа списало квоту редактирования — обновляем
        // счётчик «Использование» в сайдбаре сразу, без перезагрузки.
        queryClient.invalidateQueries(
          trpc.subscriptions.mySubscription.queryFilter()
        );
        navigate({
          to: "/templates/$templateId/builder",
          params: { templateId },
          search: { documentId: data.id },
        });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  // Saved templates ("сохранёнки").
  const { data: bookmarks = [] } = useQuery(
    trpc.templates.myBookmarks.queryOptions()
  );
  const isBookmarked = bookmarks.includes(templateId);
  const bookmarkMutation = useMutation(
    trpc.templates.toggleBookmark.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.templates.myBookmarks.queryKey(),
        }),
      onError: (err) => toast.error(err.message),
    })
  );

  // Edit: платные шаблоны идут через модалку «Редактирование договора» по
  // макетам («Разовый» — стоимость/экономия/итог и оплата, «Подписка» —
  // сводка и создание копии). Бесплатные — сразу черновик и конструктор.
  const handleEdit = () => {
    if (!template) {
      return;
    }
    if (template.price > 0) {
      setEditOpen(true);
      return;
    }
    createDraftMutation.mutate({
      templateId,
      title: template.title,
      variables: {},
    });
  };

  // "4 999 ₸" — matches the catalogue card; free templates show a label.
  const formatPrice = (tenge: number) =>
    tenge > 0 ? `${tenge.toLocaleString("ru-RU")} ₸` : t("templates.free");

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Загрузка шаблона...</div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <FileText className="size-12 text-muted-foreground/40" />
        <p className="mt-3 font-medium text-foreground text-sm">
          Шаблон не найден
        </p>
        <Link
          className="mt-2 text-primary text-sm hover:underline"
          to="/templates"
        >
          Назад к шаблонам
        </Link>
      </div>
    );
  }

  // Document content for the current UI language (falls back to the default).
  const localized = resolveLocalized(
    {
      title: template.title,
      description: template.description,
      typstContent: template.typstContent,
    },
    template.localizedContent,
    i18n.language
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header: по макету единая шапка — хлебные крошки + действия + язык и
          выход (панель приложения на десктопе скрыта); на мобильных кнопки
          уходят под хлебные крошки */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-[#e5e5e5] border-b bg-background py-2 pr-4 pl-3 sm:pr-6 md:min-h-[54px] md:flex-nowrap">
        <nav className="flex min-w-0 items-center text-sm">
          <Link
            className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-foreground transition-colors hover:bg-muted"
            to="/templates"
          >
            <FolderOpen className="size-4" />
            Шаблоны
          </Link>
          <span className="shrink-0 text-muted-foreground">/</span>
          <span className="truncate px-3 py-2 text-foreground">
            {localized.title}
          </span>
        </nav>
        {/* Action buttons: Сохранить + Скачать + Редактировать */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-[#d4d4d4] px-3 font-medium text-foreground text-sm shadow-xs transition-colors hover:bg-muted disabled:opacity-60"
              disabled={bookmarkMutation.isPending}
              onClick={() => bookmarkMutation.mutate({ templateId })}
              type="button"
            >
              <Bookmark
                className={isBookmarked ? "size-4 fill-current" : "size-4"}
              />
              {isBookmarked
                ? t("templates.bookmarked")
                : t("templates.bookmark")}
            </button>
            {/* «Скачать» открывает модалку по макету: формат, стоимость/квота
                и оплата, если доступ не покрыт. */}
            <button
              className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-[#d4d4d4] bg-background px-3 font-medium text-foreground text-sm shadow-xs transition-colors hover:bg-muted"
              onClick={() => setDownloadOpen(true)}
              type="button"
            >
              <Download className="size-4" />
              {t("templates.download")}
            </button>
            {/* Цена не в подписи, а в модалке «Редактирование договора» —
                платные шаблоны всегда открывают её. */}
            <button
              className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg bg-[#9e1f5a] px-3 font-medium text-[#fafafa] text-sm transition-colors hover:bg-[#8b1a50] disabled:opacity-60"
              disabled={createDraftMutation.isPending}
              onClick={handleEdit}
              type="button"
            >
              <PenLine className="size-4" />
              {t("templates.edit")}
            </button>
          </div>
          {/* Язык интерфейса и выход — по макету в шапке страницы шаблона.
              На мобильных их уже показывает панель приложения. */}
          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher />
            <HeaderSignOut />
          </div>
        </div>
      </div>

      {/* Content: на мобильных — предпросмотр и инфо-панель в столбик, общий
          скролл; на десктопе — две независимо скроллящиеся колонки */}
      <div className="flex flex-1 flex-col overflow-auto lg:flex-row lg:overflow-hidden">
        {/* Preview Section */}
        <div className="bg-muted/30 p-4 sm:p-6 lg:flex-1 lg:overflow-auto">
          <div className="mx-auto max-w-3xl">
            <div className="relative">
              <PreviewPane
                key={templateId}
                locale={i18n.language}
                paid={template.price > 0}
                photoVersion={new Date(template.updatedAt).getTime()}
                previewLimited={template.previewLimited}
                previewValues={previewValues}
                templateId={templateId}
                typstContent={localized.typstContent}
                variables={variables}
              />
              {/* Paywall: the rest of the document is not sent to the client —
                  this overlay just fades/blurs the truncated tail + sells access. */}
              {template.previewLimited && (
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end gap-3 rounded-b-lg bg-gradient-to-t from-background via-background/95 to-transparent px-6 pt-24 pb-6 text-center backdrop-blur-[2px]">
                  <p className="max-w-sm font-medium text-foreground text-sm">
                    Это предпросмотр — показана только часть документа. Купите
                    шаблон, чтобы увидеть его целиком.
                  </p>
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#9e1f5a] px-4 font-medium text-[#fafafa] text-sm transition-colors hover:bg-[#8b1a50] disabled:opacity-60"
                    disabled={createDraftMutation.isPending}
                    onClick={handleEdit}
                    type="button"
                  >
                    Получить полный доступ — {formatPrice(template.price)}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info sidebar (sells the template; no raw field dump) */}
        <TemplateInfoSidebar
          categories={template.categories ?? []}
          description={localized.description}
          documentType={template.documentType}
          fieldCount={variables.length}
          title={localized.title}
          updatedAt={template.updatedAt}
        />
      </div>

      <TemplateDownloadDialog
        downloadPrice={template.downloadPrice}
        initialPayment={paymentTarget === "download" ? initialPayment : null}
        onOpenChange={setDownloadOpen}
        open={downloadOpen}
        templateId={templateId}
        templateTitle={localized.title}
      />
      <TemplateEditDialog
        initialPayment={paymentTarget === "edit" ? initialPayment : null}
        onOpenChange={setEditOpen}
        open={editOpen}
        price={template.price}
        templateId={templateId}
        templateTitle={localized.title}
      />
    </div>
  );
}
