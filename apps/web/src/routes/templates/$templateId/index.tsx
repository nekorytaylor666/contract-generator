import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";
import { useMemo } from "react";

import { InteractiveDocumentPreview } from "@/components/template-builder/interactive-document-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth-guard";
import { useTRPC } from "@/utils/trpc";
import type { TemplateVariable } from "../";

// Same style preset the admin uses for in-app previews.
const PREVIEW_STYLE = { font: "", preset: "default" } as const;
const noopValueChange = () => undefined;

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

  const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toFixed(2);
  };

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
              {template.title}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground text-xs">
              {template.description}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {variables.length} полей для заполнения
              </span>
            </div>
          </div>
          <Badge className="shrink-0 text-sm" variant="secondary">
            {formatPrice(template.price)} SAR
          </Badge>
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
            <div className="h-[80vh] overflow-hidden rounded-lg border border-border bg-background">
              {template.typstContent ? (
                <InteractiveDocumentPreview
                  logo={null}
                  onValueChange={noopValueChange}
                  style={PREVIEW_STYLE}
                  typstContent={template.typstContent}
                  values={previewValues}
                  variables={variables}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <FileText className="mx-auto size-16 text-muted-foreground/30" />
                    <p className="mt-3 text-muted-foreground text-sm">
                      У шаблона нет Typst-контента
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fields Sidebar */}
        <div className="w-80 shrink-0 overflow-auto border-border border-l bg-background p-4">
          <h2 className="mb-2 font-medium text-foreground text-sm">
            Необходимая информация
          </h2>
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

          <Button asChild className="mt-4 w-full" size="lg">
            <Link params={{ templateId }} to="/templates/$templateId/builder">
              Использовать шаблон
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
