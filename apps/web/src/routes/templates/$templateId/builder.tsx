import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type DocumentStyle,
  DocumentStyleSettings,
} from "@/components/template-builder/document-style-settings";
import { InteractiveDocumentPreview } from "@/components/template-builder/interactive-document-preview";
import { LogoUpload } from "@/components/template-builder/logo-upload";
import { TemplateForm } from "@/components/template-builder/template-form";
import { VersionHistory } from "@/components/template-builder/version-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth-guard";
import type { TemplateVariable } from "@/routes/templates";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/templates/$templateId/builder")({
  component: RouteComponent,
  validateSearch: (
    search: Record<string, unknown>
  ): { documentId?: string } => ({
    documentId: search.documentId ? String(search.documentId) : undefined,
  }),
  beforeLoad: async () => {
    const { session, organizations } = await requireAuth();
    return { session, organizations };
  },
});

function RouteComponent() {
  const { templateId } = Route.useParams();
  const { documentId: initialDocumentId } = Route.useSearch();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [logo, setLogo] = useState<string | null>(null);
  const [documentStyle, setDocumentStyle] = useState<DocumentStyle>({
    font: "New Computer Modern",
    preset: "default",
  });
  const [documentId, setDocumentId] = useState<string | undefined>(
    initialDocumentId
  );
  const [currentVersion, setCurrentVersion] = useState(1);
  const [formKey, setFormKey] = useState(0);
  const [initialValues, setInitialValues] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [changedVars, setChangedVars] = useState<Set<string>>(new Set());
  const latestValuesRef = useRef<Record<string, unknown> | null>(null);
  const isInlineUpdateRef = useRef(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const formApiRef = useRef<{
    setFieldValue: (name: string, value: unknown) => void;
    getValues: () => Record<string, unknown>;
  } | null>(null);

  const {
    data: template,
    isLoading,
    error,
  } = useQuery(trpc.templates.getById.queryOptions({ id: templateId }));

  // Load existing document if documentId is set
  const { data: existingDocument } = useQuery({
    ...trpc.documents.getById.queryOptions({ id: documentId ?? "" }),
    enabled: !!documentId,
  });

  // Set initial values from existing document
  const loadedDocIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !(existingDocument && template) ||
      loadedDocIdRef.current === existingDocument.id
    ) {
      return;
    }
    loadedDocIdRef.current = existingDocument.id;
    const rawVars = existingDocument.variables as Record<string, unknown>;
    // Hydrate date strings back to Date objects
    const templateVars = template.variables as TemplateVariable[];
    const dateFields = new Set(
      templateVars.filter((v) => v.type === "date").map((v) => v.name)
    );
    const vars: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawVars)) {
      if (dateFields.has(key) && typeof value === "string" && value) {
        vars[key] = new Date(value);
      } else {
        vars[key] = value;
      }
    }
    setInitialValues(vars);
    setFormValues(vars);
    setCurrentVersion(existingDocument.currentVersion);
    latestValuesRef.current = vars;
    if (existingDocument.logo) {
      setLogo(existingDocument.logo);
    }
    if (existingDocument.style) {
      const style = existingDocument.style as DocumentStyle;
      setDocumentStyle(style);
    }
    setFormKey((k) => k + 1);
  }, [existingDocument, template]);

  // Initialize formValues from template defaults when no document is loaded
  useEffect(() => {
    if (!template || initialValues || existingDocument) {
      return;
    }
    const templateVars = template.variables as TemplateVariable[];
    const defaults: Record<string, unknown> = {};
    for (const v of templateVars) {
      if (v.defaultValue !== undefined) {
        defaults[v.name] = v.defaultValue;
      } else {
        switch (v.type) {
          case "boolean":
            defaults[v.name] = false;
            break;
          case "date":
            defaults[v.name] = undefined;
            break;
          default:
            defaults[v.name] = "";
            break;
        }
      }
    }
    setFormValues(defaults);
    latestValuesRef.current = defaults;
  }, [template, initialValues, existingDocument]);

  const triggerHighlight = useCallback((names: Set<string>) => {
    if (names.size === 0) {
      return;
    }
    setChangedVars(names);
    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(
      () => setChangedVars(new Set()),
      4000
    );
  }, []);

  const handleInlineChange = useCallback(
    (name: string, value: unknown) => {
      isInlineUpdateRef.current = true;
      setFormValues((prev) => {
        const next = { ...prev, [name]: value };
        latestValuesRef.current = next;
        return next;
      });
      // Highlight the changed variable + any conditionals it affects
      triggerHighlight(new Set([name]));
      // Push into TanStack Form so sidebar fields update
      formApiRef.current?.setFieldValue(name, value);
      requestAnimationFrame(() => {
        isInlineUpdateRef.current = false;
      });
    },
    [triggerHighlight]
  );

  const compileMutation = useMutation(
    trpc.templates.compile.mutationOptions({
      onSuccess: (data) => {
        const link = document.createElement("a");
        link.href = data.pdfDataUrl;
        link.download = data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
    })
  );

  const saveMutation = useMutation(
    trpc.documents.save.mutationOptions({
      onSuccess: (data) => {
        setDocumentId(data.id);
        setCurrentVersion(data.version);
        // Update URL with documentId
        navigate({
          to: "/templates/$templateId/builder",
          params: { templateId },
          search: { documentId: data.id },
          replace: true,
        });
        // Invalidate version list
        if (documentId) {
          queryClient.invalidateQueries({
            queryKey: trpc.documents.listVersions.queryKey({
              documentId: data.id,
            }),
          });
        }
      },
    })
  );

  const handleValuesChange = useCallback(
    (values: Record<string, unknown>) => {
      if (isInlineUpdateRef.current) {
        return;
      }
      const prev = latestValuesRef.current;
      if (prev) {
        const changed = new Set<string>();
        for (const key of Object.keys(values)) {
          if (String(values[key] ?? "") !== String(prev[key] ?? "")) {
            changed.add(key);
          }
        }
        triggerHighlight(changed);
      }
      latestValuesRef.current = values;
      setFormValues(values);
    },
    [triggerHighlight]
  );

  const handleDownload = useCallback(() => {
    if (!latestValuesRef.current) {
      return;
    }
    compileMutation.mutate({
      templateId,
      variables: latestValuesRef.current,
      logo: logo ?? undefined,
      style: {
        font: documentStyle.font,
        preset: documentStyle.preset,
      },
    });
  }, [templateId, compileMutation.mutate, logo, documentStyle]);

  const handleSave = useCallback(() => {
    if (!latestValuesRef.current) {
      return;
    }
    saveMutation.mutate({
      documentId: documentId ?? undefined,
      templateId,
      variables: latestValuesRef.current,
      logo,
      style: {
        font: documentStyle.font,
        preset: documentStyle.preset,
      },
    });
  }, [templateId, documentId, saveMutation.mutate, logo, documentStyle]);

  const handleLogoChange = useCallback((newLogo: string | null) => {
    setLogo(newLogo);
  }, []);

  const handleStyleChange = useCallback((newStyle: DocumentStyle) => {
    setDocumentStyle(newStyle);
  }, []);

  const handlePreviewVersion = useCallback(
    (
      rawVariables: Record<string, unknown>,
      versionLogo: string | null,
      versionStyle: { font?: string; preset?: string } | null
    ) => {
      // Preview version inline — hydrate dates and set form values
      const templateVars = (template?.variables ?? []) as TemplateVariable[];
      const dateFields = new Set(
        templateVars.filter((v) => v.type === "date").map((v) => v.name)
      );
      const variables: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rawVariables)) {
        if (dateFields.has(key) && typeof value === "string" && value) {
          variables[key] = new Date(value);
        } else {
          variables[key] = value;
        }
      }
      setFormValues(variables);
      latestValuesRef.current = variables;
      if (versionLogo !== null) {
        setLogo(versionLogo);
      }
      if (versionStyle) {
        setDocumentStyle({
          font: versionStyle.font ?? "New Computer Modern",
          preset: versionStyle.preset ?? "default",
        });
      }
    },
    [template?.variables]
  );

  const handleRevert = useCallback(
    (
      rawVariables: Record<string, unknown>,
      revertedLogo: string | null,
      revertedStyle: { font?: string; preset?: string } | null
    ) => {
      const templateVars = (template?.variables ?? []) as TemplateVariable[];
      const dateFields = new Set(
        templateVars.filter((v) => v.type === "date").map((v) => v.name)
      );
      const variables: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rawVariables)) {
        if (dateFields.has(key) && typeof value === "string" && value) {
          variables[key] = new Date(value);
        } else {
          variables[key] = value;
        }
      }
      setInitialValues(variables);
      setFormValues(variables);
      latestValuesRef.current = variables;
      if (revertedLogo !== undefined) {
        setLogo(revertedLogo);
      }
      if (revertedStyle) {
        setDocumentStyle({
          font: revertedStyle.font ?? "New Computer Modern",
          preset: revertedStyle.preset ?? "default",
        });
      }
      setFormKey((k) => k + 1);
    },
    [template?.variables]
  );

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
        <p className="font-medium text-foreground text-sm">Шаблон не найден</p>
        <Link
          className="mt-2 text-primary text-sm hover:underline"
          to="/templates"
        >
          Назад к шаблонам
        </Link>
      </div>
    );
  }

  const variables = template.variables as TemplateVariable[];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-border border-b bg-background p-4">
        <Link
          className="mb-3 inline-flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
          params={{ templateId }}
          to="/templates/$templateId"
        >
          <ArrowLeft className="size-3.5" />
          Назад к шаблону
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-semibold text-base text-foreground">
              {template.title}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground text-xs">
              Заполните данные ниже для создания документа
            </p>
          </div>
          <Badge className="shrink-0 text-sm" variant="secondary">
            {(template.price / 100).toFixed(2)} SAR
          </Badge>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-border border-b bg-background px-4 py-2">
        <DocumentStyleSettings
          onStyleChange={handleStyleChange}
          style={documentStyle}
        />
        <div className="ml-auto">
          <Button
            onClick={() => setSidebarOpen((o) => !o)}
            size="sm"
            title={sidebarOpen ? "Скрыть панель" : "Показать панель"}
            variant="ghost"
          >
            {sidebarOpen ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Interactive Document Preview */}
        <div className="flex-1 overflow-auto bg-muted/30 p-4">
          <div className="mx-auto h-full max-w-5xl">
            <InteractiveDocumentPreview
              changedVars={changedVars}
              isDownloading={compileMutation.isPending}
              isSaving={saveMutation.isPending}
              logo={logo}
              onDownload={handleDownload}
              onSave={handleSave}
              onValueChange={handleInlineChange}
              style={documentStyle}
              typstContent={template.typstContent}
              values={formValues}
              variables={variables}
            />
          </div>
        </div>

        {/* Form Sidebar — collapsible */}
        {sidebarOpen && (
          <div className="w-80 shrink-0 overflow-auto border-border border-l bg-background p-4">
            <h2 className="mb-2 font-medium text-foreground text-sm">
              Детали документа
            </h2>
            <p className="mb-4 text-muted-foreground text-xs">
              Заполните необходимую информацию для создания документа.
            </p>

            <LogoUpload logo={logo} onLogoChange={handleLogoChange} />

            <TemplateForm
              formApiRef={formApiRef}
              initialValues={initialValues ?? undefined}
              isSubmitting={compileMutation.isPending}
              key={formKey}
              onValuesChange={handleValuesChange}
              variables={variables}
            />

            {documentId && (
              <div className="mt-4">
                <VersionHistory
                  currentVersion={currentVersion}
                  documentId={documentId}
                  onPreviewVersion={handlePreviewVersion}
                  onRevert={handleRevert}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
