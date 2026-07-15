import {
  resolveLocalized,
  resolveLocalizedVariables,
} from "@contract-builder/api/constants/template-options";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  type DocumentStyle,
  DocumentStyleSettings,
} from "@/components/template-builder/document-style-settings";
import { InteractiveDocumentPreview } from "@/components/template-builder/interactive-document-preview";
import { LogoUpload } from "@/components/template-builder/logo-upload";
import { NativeForm } from "@/components/template-builder/native-form";
import { NativeInlinePreview } from "@/components/template-builder/native-inline-preview";
import { PreviewErrorBoundary } from "@/components/template-builder/preview-error-boundary";
import {
  isComplexNative,
  isNativeTypst,
} from "@/components/template-builder/server-typst-preview";
import { VersionHistory } from "@/components/template-builder/version-history";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth-guard";
import { remapValuesForLocale } from "@/lib/locale-values";
import { parseNativeLets } from "@/lib/native-typst";
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

function pluralFields(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return "поля";
  }
  return "полей";
}

// The same variable-resolution chain the render path uses: admin-synced
// per-locale variables, else fillable `#let`s parsed from that locale's typst.
function variablesForLocale(
  template: {
    title: string;
    description: string | null;
    typstContent: string;
    variables?: unknown;
    localizedContent: Parameters<typeof resolveLocalized>[1];
  },
  locale: string
): TemplateVariable[] {
  const stored = resolveLocalizedVariables<TemplateVariable>(
    (template.variables ?? []) as TemplateVariable[],
    template.localizedContent,
    locale
  );
  if (stored.length > 0) {
    return stored;
  }
  const source = resolveLocalized(
    {
      title: template.title,
      description: template.description,
      typstContent: template.typstContent,
    },
    template.localizedContent,
    locale
  );
  return isNativeTypst(source.typstContent)
    ? parseNativeLets(source.typstContent)
    : [];
}

function RouteComponent() {
  const { templateId } = Route.useParams();
  const { documentId: initialDocumentId } = Route.useSearch();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const { data: myAccess } = useQuery(trpc.team.myAccess.queryOptions());
  const canEdit = myAccess?.canEdit !== false;
  const [logo, setLogo] = useState<string | null>(null);
  // Contract language — starts from the UI language but is switched
  // independently via the «Язык договора» select in the toolbar.
  const [docLocale, setDocLocale] = useState<string>(i18n.language);
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
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const formApiRef = useRef<{
    setFieldValue: (name: string, value: unknown) => void;
    getValues: () => Record<string, unknown>;
  } | null>(null);

  const {
    data: template,
    isLoading,
    error,
  } = useQuery({
    ...trpc.templates.getById.queryOptions({ id: templateId }),
    // Fresh template on every builder entry — admin edits (variables,
    // defaults, prices) must not be served from a stale SPA cache. Focus
    // refetch is forced so an admin edit in another window shows up as soon
    // as this one is focused again.
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });

  // Admin-synced variables for the selected contract language: a locale with
  // its own typst carries its own variables (labels/hints/option literals
  // match it).
  const storedVariables = useMemo<TemplateVariable[]>(
    () =>
      template
        ? resolveLocalizedVariables(
            template.variables as TemplateVariable[],
            template.localizedContent,
            docLocale
          )
        : [],
    [template, docLocale]
  );

  // Load existing document if documentId is set
  const { data: existingDocument } = useQuery({
    ...trpc.documents.getById.queryOptions({ id: documentId ?? "" }),
    enabled: !!documentId,
  });

  // Admin-set defaults for every variable of the template (full set, NOT
  // filtered by reachability). Computed synchronously so the form gets them
  // on its very first mount — an effect would lose the race for complex
  // native templates, leaving toggles/radios visually unset while the
  // document preview already renders the default branch.
  const templateDefaults = useMemo<Record<string, unknown>>(() => {
    if (!template) {
      return {};
    }
    // Same per-locale resolution chain as everywhere else — the fallback must
    // parse the CONTRACT language's typst, or defaults would carry base-locale
    // literals into another locale's form.
    const templateVars = variablesForLocale(template, docLocale);
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
    return defaults;
  }, [template, docLocale]);

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
    const dateFields = new Set(
      storedVariables.filter((v) => v.type === "date").map((v) => v.name)
    );
    // Defaults underneath: fields added to the template after this document
    // was saved still get their admin-set defaults instead of undefined.
    const vars: Record<string, unknown> = { ...templateDefaults };
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
  }, [existingDocument, template, storedVariables, templateDefaults]);

  // Initialize formValues from template defaults when no document is loaded.
  // Once per template id: re-runs (language switch, query refetch) must not
  // clobber values the user has already typed.
  const defaultsInitRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !template ||
      initialValues ||
      existingDocument ||
      defaultsInitRef.current === template.id
    ) {
      return;
    }
    defaultsInitRef.current = template.id;
    setFormValues(templateDefaults);
    latestValuesRef.current = templateDefaults;
  }, [template, initialValues, existingDocument, templateDefaults]);

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
        // Invalidate "my documents" list so the newly saved doc appears there.
        queryClient.invalidateQueries({
          queryKey: trpc.documents.list.queryKey(),
        });
        // Invalidate version list for existing docs.
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
    // Always compile the LIVE template — the on-screen preview and the form
    // already render it, so the downloaded PDF must match. Pinning the
    // document's templateVersionId here served week-old snapshots after every
    // admin edit ("the template never updates").
    compileMutation.mutate({
      templateId,
      locale: docLocale,
      variables: latestValuesRef.current,
      logo: logo ?? undefined,
      style: {
        font: documentStyle.font,
        preset: documentStyle.preset,
      },
    });
  }, [templateId, compileMutation.mutate, logo, documentStyle, docLocale]);

  const handleSave = useCallback(() => {
    if (!(canEdit && latestValuesRef.current)) {
      return;
    }
    saveMutation.mutate({
      documentId: documentId ?? undefined,
      templateId,
      // Names a newly created document after the template's title in the
      // selected contract language.
      locale: docLocale,
      variables: latestValuesRef.current,
      logo,
      style: {
        font: documentStyle.font,
        preset: documentStyle.preset,
      },
    });
  }, [
    templateId,
    documentId,
    saveMutation.mutate,
    logo,
    documentStyle,
    canEdit,
    docLocale,
  ]);

  const handleLogoChange = useCallback((newLogo: string | null) => {
    setLogo(newLogo);
  }, []);

  const handleStyleChange = useCallback((newStyle: DocumentStyle) => {
    setDocumentStyle(newStyle);
  }, []);

  // Contract-language switch. Values hold locale-bound literals («Юридическое
  // лицо» ↔ «Заңды тұлға») that the new locale's `#if` conditions compare
  // byte-for-byte — carry them over instead of keeping the old-locale text,
  // then remount the form so it picks up the translated values and labels.
  const handleLocaleChange = useCallback(
    (nextLocale: string) => {
      if (!template || nextLocale === docLocale) {
        return;
      }
      const { values, changed } = remapValuesForLocale(
        latestValuesRef.current ?? formValues,
        variablesForLocale(template, docLocale),
        variablesForLocale(template, nextLocale)
      );
      setDocLocale(nextLocale);
      if (changed.size > 0) {
        setInitialValues(values);
        setFormValues(values);
        latestValuesRef.current = values;
        setFormKey((k) => k + 1);
        triggerHighlight(changed);
        // Auto-translation is best-effort — in a legal document the user must
        // eyeball the substituted literals, so point them at the highlights.
        toast.info(
          `Значения ${changed.size} ${pluralFields(changed.size)} переведены под выбранный язык — проверьте подсвеченные поля`
        );
      }
    },
    [template, docLocale, formValues, triggerHighlight]
  );

  const handlePreviewVersion = useCallback(
    (
      rawVariables: Record<string, unknown>,
      versionLogo: string | null,
      versionStyle: { font?: string; preset?: string } | null
    ) => {
      // Preview version inline — hydrate dates and set form values.
      // Defaults underneath, like the doc-load path: fields the template
      // gained after this version was saved must not become undefined.
      const dateFields = new Set(
        storedVariables.filter((v) => v.type === "date").map((v) => v.name)
      );
      const variables: Record<string, unknown> = { ...templateDefaults };
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
    [storedVariables, templateDefaults]
  );

  const handleRevert = useCallback(
    (
      rawVariables: Record<string, unknown>,
      revertedLogo: string | null,
      revertedStyle: { font?: string; preset?: string } | null
    ) => {
      const dateFields = new Set(
        storedVariables.filter((v) => v.type === "date").map((v) => v.name)
      );
      // Defaults underneath — reverting to a version saved before the
      // template gained new defaulted fields must not leave them undefined
      // (the form would show unset controls while the document renders the
      // typst literal's branch).
      const variables: Record<string, unknown> = { ...templateDefaults };
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
    [storedVariables, templateDefaults]
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

  // Document content for the selected contract language (falls back to the
  // default when the template has no override for it).
  const localized = resolveLocalized(
    {
      title: template.title,
      description: template.description,
      typstContent: template.typstContent,
    },
    template.localizedContent,
    docLocale
  );
  // Language the resolved content is ACTUALLY in: placeholders («Введите…» /
  // «… енгізіңіз») must match the labels, and when the template has no
  // version for docLocale everything falls back to the base (authored in
  // Russian) — a Kazakh lead-in next to Russian labels would look broken.
  const contentLocale = template.localizedContent?.[docLocale]?.typstContent
    ? docLocale
    : "ru";

  // Native Typst (#let) templates may have no synced variables[] — fall back to
  // parsing fillable `#let` fields out of the source so they drive the same form
  // as the {{var}} format. Admin-synced variables take priority.
  let variables = storedVariables;
  if (storedVariables.length === 0 && isNativeTypst(localized.typstContent)) {
    variables = parseNativeLets(localized.typstContent);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-border border-b bg-background px-4 py-3">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            to="/documents"
          >
            Мои документы
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="truncate font-medium text-foreground">
            {localized.title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {saveMutation.isPending && (
            <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Сохранение…
            </span>
          )}
          {!saveMutation.isPending && changedVars.size > 0 && (
            <Button
              disabled={!canEdit}
              onClick={handleSave}
              size="sm"
              variant="outline"
            >
              Сохранить
            </Button>
          )}
          {!(saveMutation.isPending || changedVars.size > 0) && (
            <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <Check className="size-4 text-green-600" />
              Сохранено
            </span>
          )}
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={compileMutation.isPending}
            onClick={handleDownload}
          >
            {compileMutation.isPending ? "Скачивание…" : "Скачать договор"}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-border border-b bg-background px-4 py-2">
        <DocumentStyleSettings
          locale={docLocale}
          onLocaleChange={handleLocaleChange}
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
            <PreviewErrorBoundary>
              {isComplexNative(localized.typstContent) ? (
                <NativeInlinePreview
                  changedVars={changedVars}
                  logo={logo}
                  onValueChange={handleInlineChange}
                  style={documentStyle}
                  typstContent={localized.typstContent}
                  values={formValues}
                  variables={variables}
                />
              ) : (
                <InteractiveDocumentPreview
                  changedVars={changedVars}
                  logo={logo}
                  onValueChange={handleInlineChange}
                  style={documentStyle}
                  typstContent={localized.typstContent}
                  values={formValues}
                  variables={variables}
                />
              )}
            </PreviewErrorBoundary>
          </div>
        </div>

        {/* Form Sidebar — collapsible */}
        {sidebarOpen && (
          <div className="w-96 shrink-0 overflow-auto border-border border-l bg-background p-5">
            <h2 className="font-semibold text-foreground text-xl leading-tight">
              {localized.title}
            </h2>
            <p className="mt-2 mb-5 text-muted-foreground text-sm leading-relaxed">
              {localized.description ||
                "Заполните поля — документ слева обновится автоматически."}
            </p>

            <LogoUpload logo={logo} onLogoChange={handleLogoChange} />

            <PreviewErrorBoundary>
              <NativeForm
                formApiRef={formApiRef}
                initialValues={initialValues ?? templateDefaults}
                isSubmitting={compileMutation.isPending}
                key={formKey}
                locale={contentLocale}
                onValuesChange={handleValuesChange}
                typstContent={localized.typstContent}
                values={formValues}
                variables={variables}
              />
            </PreviewErrorBoundary>

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
