import { resolveLocalized } from "@contract-builder/api/constants/template-options";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  Download,
  FileText,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { InteractiveDocumentPreview } from "@/components/template-builder/interactive-document-preview";
import {
  isNativeTypst,
  ServerTypstPreview,
} from "@/components/template-builder/server-typst-preview";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// Picks the right preview: native Typst (#let/functions) compiles server-side;
// the `{{var}}` format uses the interactive client parser.
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
  if (isNativeTypst(typstContent)) {
    return <ServerTypstPreview typstContent={typstContent} />;
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

  const {
    data: template,
    isLoading,
    error,
  } = useQuery(trpc.templates.getById.queryOptions({ id: templateId }));

  // Stable variables array per template load.
  const variables = useMemo<TemplateVariable[]>(
    () => (template?.variables ?? []) as TemplateVariable[],
    [template]
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

  const { t, i18n } = useTranslation();
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
      {/* Header */}
      <div className="border-border border-b bg-background p-4">
        <Link
          className="mb-3 inline-flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
          to="/templates"
        >
          <ArrowLeft className="size-3.5" />
          Назад к шаблонам
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-semibold text-base text-foreground">
              {localized.title}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {variables.length} полей для заполнения
              </span>
            </div>
          </div>
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
              {isBookmarked
                ? t("templates.bookmarked")
                : t("templates.bookmark")}
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
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Preview Section */}
        <div className="flex-1 overflow-auto bg-muted/30 p-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-3 font-medium text-foreground text-sm">
              Предпросмотр договора
            </h2>
            <div className="relative">
              <div
                className={cn(
                  "overflow-hidden rounded-lg border border-border bg-background",
                  template.previewLimited ? "max-h-[460px]" : "h-[80vh]"
                )}
              >
                <PreviewBody
                  previewValues={previewValues}
                  typstContent={localized.typstContent}
                  variables={variables}
                />
              </div>
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

        {/* Fields Sidebar */}
        <div className="w-96 shrink-0 overflow-auto border-border border-l bg-background p-5">
          <h2 className="font-semibold text-foreground text-xl leading-tight">
            {localized.title}
          </h2>
          {localized.description && (
            <p className="mt-2 mb-6 text-muted-foreground text-sm leading-relaxed">
              {localized.description}
            </p>
          )}
          <h3 className="mb-2 font-medium text-foreground text-sm">
            Необходимая информация
          </h3>
          <p className="mb-4 text-muted-foreground text-xs">
            Эти поля необходимо заполнить при использовании шаблона.
          </p>

          <div className="space-y-2">
            {variables.map((field) => (
              <Card key={field.name} size="sm">
                <CardHeader className="pb-1">
                  <CardTitle className="flex items-center gap-1.5">
                    {field.label}
                    {field.required && (
                      <span className="text-destructive">*</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{field.type}</Badge>
                    {field.options && (
                      <span className="text-muted-foreground text-xs">
                        {field.options.length} options
                      </span>
                    )}
                    {field.defaultValue !== undefined && (
                      <span className="text-muted-foreground text-xs">
                        По умолчанию: {String(field.defaultValue)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
