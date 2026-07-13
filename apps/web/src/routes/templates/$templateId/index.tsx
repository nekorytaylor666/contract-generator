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
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Download,
  FileText,
  FolderOpen,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { InteractiveDocumentPreview } from "@/components/template-builder/interactive-document-preview";
import { NativeInlinePreview } from "@/components/template-builder/native-inline-preview";
import {
  isComplexNative,
  isNativeTypst,
} from "@/components/template-builder/server-typst-preview";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { requireAuth } from "@/lib/auth-guard";
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
    <aside className="flex w-[365px] shrink-0 flex-col gap-4 overflow-auto border-border border-l bg-background p-6">
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
  beforeLoad: async () => {
    const { session, organizations } = await requireAuth();
    return { session, organizations };
  },
});

function RouteComponent() {
  const { templateId } = Route.useParams();
  const trpc = useTRPC();
  const { t, i18n } = useTranslation();

  const {
    data: template,
    isLoading,
    error,
  } = useQuery(trpc.templates.getById.queryOptions({ id: templateId }));

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

  const { data: purchases = [] } = useQuery(
    trpc.payments.myPurchases.queryOptions()
  );
  const hasEdit = purchases.some(
    (p) => p.templateId === templateId && p.kind === "edit"
  );
  // Any purchase (edit or download) unlocks the download.
  const hasDownload = purchases.some((p) => p.templateId === templateId);

  // The subscription covers edit/download while there's quota left (-1 = ∞).
  const { data: mySub } = useQuery(
    trpc.subscriptions.mySubscription.queryOptions()
  );
  const hasEditQuota =
    mySub?.editRemaining === -1 || (mySub?.editRemaining ?? 0) > 0;
  const hasDownloadQuota =
    mySub?.downloadRemaining === -1 || (mySub?.downloadRemaining ?? 0) > 0;

  const [isPaying, setIsPaying] = useState(false);

  const goToBuilder = () =>
    navigate({ to: "/templates/$templateId/builder", params: { templateId } });

  const checkoutMutation = useMutation(
    trpc.payments.createTemplateCheckout.mutationOptions({
      onSuccess: (result, vars) => {
        if (result.alreadyPurchased) {
          queryClient.invalidateQueries({
            queryKey: trpc.payments.myPurchases.queryKey(),
          });
          if (vars.kind !== "download") {
            goToBuilder();
          }
          setIsPaying(false);
          return;
        }
        window.location.href = result.url;
      },
      onError: (error) => {
        toast.error(error.message);
        setIsPaying(false);
      },
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

  // Create the document up-front so it shows in "Мои документы" immediately,
  // then open the builder editing it (further changes update the same doc).
  const createDraftMutation = useMutation(
    trpc.documents.save.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.documents.list.queryKey(),
        });
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

  // Edit: if already paid (edit) or free, open the builder; else start an
  // edit-kind checkout (which forwards to the builder once paid).
  const handleEdit = () => {
    if (!template) {
      return;
    }
    if (hasEdit || template.price === 0 || hasEditQuota) {
      createDraftMutation.mutate({
        templateId,
        title: template.title,
        variables: {},
      });
      return;
    }
    setIsPaying(true);
    checkoutMutation.mutate({ templateId, kind: "edit" });
  };

  const canDownload =
    hasDownload || template?.downloadPrice === 0 || hasDownloadQuota;

  // Download a finished copy in the chosen format: if already paid (any
  // purchase) or free, fetch the file; otherwise start a download-kind checkout.
  const handleDownload = (format: "pdf" | "docx") => {
    if (!template) {
      return;
    }
    if (canDownload) {
      downloadMutation.mutate({ templateId, locale: i18n.language, format });
      return;
    }
    checkoutMutation.mutate({ templateId, kind: "download" });
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
      {/* Header: breadcrumb + actions */}
      <div className="flex items-center justify-between gap-4 border-border border-b bg-background px-4 py-3">
        <nav className="flex min-w-0 items-center gap-1 text-sm">
          <Link
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground"
            to="/templates"
          >
            <FolderOpen className="size-4" />
            Шаблоны
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
          <span className="truncate px-1.5 font-medium text-foreground">
            {localized.title}
          </span>
        </nav>
        {/* Action buttons: Сохранить + Скачать (secondary) + Редактировать */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#ececec] px-4 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-60"
            disabled={bookmarkMutation.isPending}
            onClick={() => bookmarkMutation.mutate({ templateId })}
            type="button"
          >
            <Bookmark
              className={isBookmarked ? "size-4 fill-current" : "size-4"}
            />
            {isBookmarked ? t("templates.bookmarked") : t("templates.bookmark")}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f5f5f5] px-4 font-medium text-[#171717] text-sm outline-none transition-colors hover:bg-[#ececec] disabled:opacity-60"
              disabled={downloadMutation.isPending}
            >
              <Download className="size-4" />
              {canDownload
                ? t("templates.download")
                : `${t("templates.download")} — ${formatPrice(template.downloadPrice)}`}
              <ChevronDown className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem onSelect={() => handleDownload("docx")}>
                <Download className="size-4" />
                Скачать в DocX
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleDownload("pdf")}>
                <Download className="size-4" />
                Скачать в PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#9e1f5a] px-4 font-medium text-[#fafafa] text-sm transition-colors hover:bg-[#8b1a50] disabled:opacity-60"
            disabled={isPaying || createDraftMutation.isPending}
            onClick={handleEdit}
            type="button"
          >
            {hasEdit || template.price === 0 || hasEditQuota
              ? t("templates.edit")
              : `${t("templates.edit")} — ${formatPrice(template.price)}`}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Preview Section */}
        <div className="flex-1 overflow-auto bg-muted/30 p-6">
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
                    disabled={isPaying || createDraftMutation.isPending}
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
    </div>
  );
}
