import {
  CATEGORY_LABEL_BY_SLUG,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_VALUES,
  type LocaleContent,
  TEMPLATE_LOCALE_LABELS,
  TEMPLATE_LOCALES,
  type TemplateLocale,
} from "@contract-builder/api/constants/template-options";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { InteractiveDocumentPreview } from "@/components/template-builder/interactive-document-preview";
import { NativeInlinePreview } from "@/components/template-builder/native-inline-preview";
import { isComplexNative } from "@/components/template-builder/server-typst-preview";
import { VariableCard } from "@/components/template-builder/variable-card";
import { CategoryFilter } from "@/components/templates/category-filter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth-guard";
import {
  detectVariables,
  type MergedVariable,
  mergeWithDetected,
} from "@/lib/template-variable-detector";
import type { TemplateVariable } from "@/routes/templates";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/templates")({
  component: AdminTemplatesPage,
  beforeLoad: async () => {
    const { session } = await requireAdmin();
    return { session };
  },
});

interface TemplateRow {
  id: string;
  title: string;
  description: string | null;
  price: number;
  downloadPrice: number;
  typstContent: string;
  variables: unknown;
  isPublished: boolean;
  categories: string[] | null;
  documentType: string | null;
  localizedContent: Record<string, LocaleContent> | null;
  updatedAt: string | Date;
}

interface LocaleForm {
  title: string;
  description: string;
  typstContent: string;
  // The locale's own form variables — labels/hints/options in that language.
  // Empty → the fill form falls back to the shared default variables.
  variables: TemplateVariable[];
}

interface FormState {
  title: string;
  description: string;
  price: string;
  downloadPrice: string;
  typstContent: string;
  variables: TemplateVariable[];
  isPublished: boolean;
  categories: string[];
  documentType: string;
  // Per-locale overrides (kk/ru/en). Empty fields fall back to the defaults.
  localizedContent: Record<string, LocaleForm>;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  price: "0",
  downloadPrice: "0",
  typstContent: "",
  variables: [],
  isPublished: false,
  categories: [],
  documentType: "",
  localizedContent: {},
};

const noopValueChange = () => undefined;
const defaultPreviewStyle = { font: "", preset: "comfortable" };

// Function/array-heavy native compiles server-side; `{{var}}` and simple linear
// native (only #let + #fill + #if) use the interactive client parser.
function AdminDocumentPreview({
  typstContent,
  previewValues,
  variables,
}: {
  typstContent: string;
  previewValues: Record<string, unknown>;
  variables: TemplateVariable[];
}) {
  if (isComplexNative(typstContent)) {
    return (
      <NativeInlinePreview
        logo={null}
        onValueChange={noopValueChange}
        style={defaultPreviewStyle}
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
      style={defaultPreviewStyle}
      typstContent={typstContent}
      values={previewValues}
      variables={variables}
    />
  );
}

// Save succeeds even when a source doesn't compile with the real Typst — the
// in-app preview is a lenient interpreter and won't show such errors, so the
// compiler's verdict from the save response is surfaced here (photo/PDF
// endpoints would otherwise fail silently later).
function notifyCompileWarnings(
  warnings: { locale: string; error: string }[] | undefined
) {
  for (const warning of warnings ?? []) {
    const localeLabel =
      warning.locale === "default"
        ? "По умолчанию"
        : (TEMPLATE_LOCALE_LABELS[warning.locale as TemplateLocale] ??
          warning.locale);
    toast.warning(
      `Настоящий Typst не компилирует версию «${localeLabel}» — фото и скачивание PDF работать не будут`,
      {
        // pre-line: the summary is one line per compile error.
        description: (
          <span className="whitespace-pre-line">{warning.error}</span>
        ),
        duration: 15_000,
      }
    );
  }
}

// Live compile status for the source being edited: debounced run through the
// REAL Typst compiler. The inline preview is intentionally lenient and renders
// sources the real compiler rejects, so without this the admin first learns
// about a broken template from the save warning (or worse, a 404 photo).
function CompileStatusBanner({
  typstContent,
  variables,
}: {
  typstContent: string;
  variables: TemplateVariable[];
}) {
  const trpc = useTRPC();
  // failed = the CHECK itself broke (network/server), not the template.
  const [checked, setChecked] = useState<{
    content: string;
    error: string | null;
    failed: boolean;
  } | null>(null);
  // Guards against out-of-order responses: only the check for the latest
  // debounced content may publish its result.
  const latestContentRef = useRef("");
  const check = useMutation(trpc.adminTemplates.checkCompile.mutationOptions());
  const { mutate, isPending } = check;

  // Serialized so object identity doesn't retrigger the debounce every render.
  const variablesKey = JSON.stringify(variables);
  useEffect(() => {
    if (!typstContent.trim()) {
      return;
    }
    latestContentRef.current = typstContent;
    // Verdict (or failure) for this exact content is already known — don't
    // re-spawn a compile for it (e.g. typing a char and undoing it).
    if (checked?.content === typstContent) {
      return;
    }
    // One compile in flight at a time: when it settles, isPending flips and
    // this effect re-runs — if the content moved on, the next check starts.
    if (isPending) {
      return;
    }
    const id = setTimeout(
      () =>
        mutate(
          { typstContent, variables: JSON.parse(variablesKey) },
          {
            onSuccess: (res) => {
              if (latestContentRef.current === typstContent) {
                setChecked({
                  content: typstContent,
                  error: res.error,
                  failed: false,
                });
              }
            },
            onError: () => {
              if (latestContentRef.current === typstContent) {
                setChecked({
                  content: typstContent,
                  error: null,
                  failed: true,
                });
              }
            },
          }
        ),
      800
    );
    return () => clearTimeout(id);
  }, [typstContent, variablesKey, checked, isPending, mutate]);

  if (!typstContent.trim()) {
    return null;
  }
  if (checked?.content !== typstContent) {
    return (
      <p className="shrink-0 text-muted-foreground text-xs">
        Проверяю компиляцию…
      </p>
    );
  }
  if (checked.failed) {
    return (
      <p className="shrink-0 text-muted-foreground text-xs">
        Не удалось проверить компиляцию (ошибка запроса) — проверка выполнится
        при сохранении.
      </p>
    );
  }
  if (checked.error) {
    return (
      <div className="max-h-40 shrink-0 overflow-auto whitespace-pre-line rounded border border-destructive/40 bg-destructive/10 p-2 text-destructive text-xs">
        {`Настоящий Typst не компилирует этот исходник — фото и скачивание PDF работать не будут:\n${checked.error}`}
      </div>
    );
  }
  return (
    <p className="shrink-0 text-emerald-600 text-xs">
      ✓ Компилируется настоящим Typst
    </p>
  );
}

const EMPTY_LOCALE_FORM: LocaleForm = {
  title: "",
  description: "",
  typstContent: "",
  variables: [],
};

// The title/description/typstContent currently being edited for `activeLocale`.
function getActiveContent(
  form: FormState,
  activeLocale: "default" | TemplateLocale
): LocaleForm {
  if (activeLocale === "default") {
    return {
      title: form.title,
      description: form.description,
      typstContent: form.typstContent,
      variables: form.variables,
    };
  }
  return form.localizedContent[activeLocale] ?? EMPTY_LOCALE_FORM;
}

// Set one field of the active locale (default fields, or a localized override).
function applyLocaleField(
  prev: FormState,
  activeLocale: "default" | TemplateLocale,
  field: Exclude<keyof LocaleForm, "variables">,
  value: string
): FormState {
  if (activeLocale === "default") {
    return { ...prev, [field]: value };
  }
  return {
    ...prev,
    localizedContent: {
      ...prev.localizedContent,
      [activeLocale]: {
        ...EMPTY_LOCALE_FORM,
        ...prev.localizedContent[activeLocale],
        [field]: value,
      },
    },
  };
}

// Drop empty fields and empty locales before sending to the API.
function cleanLocalizedContent(
  localizedContent: Record<string, LocaleForm>
): Record<string, LocaleContent> {
  const cleaned: Record<string, LocaleContent> = {};
  for (const [locale, content] of Object.entries(localizedContent)) {
    const entry: LocaleContent = {};
    if (content.title.trim()) {
      entry.title = content.title;
    }
    if (content.description.trim()) {
      entry.description = content.description;
    }
    if (content.typstContent.trim()) {
      entry.typstContent = content.typstContent;
    }
    if (content.variables.length > 0) {
      entry.variables = content.variables;
    }
    if (Object.keys(entry).length > 0) {
      cleaned[locale] = entry;
    }
  }
  return cleaned;
}

// Variables the active tab edits: the locale's own set when it has one. A
// locale with its own typst seeds its first sync from the default set minus
// the language-bound fields (options/descriptions/defaults/hints come from
// that locale's typst comments); otherwise the default set is shared as-is.
function resolveActiveStoredVariables(
  localeForm: LocaleForm | null,
  baseVariables: TemplateVariable[]
): TemplateVariable[] {
  if (!localeForm) {
    return baseVariables;
  }
  if (localeForm.variables.length > 0) {
    return localeForm.variables;
  }
  if (localeForm.typstContent.trim()) {
    return baseVariables.map(
      ({
        options,
        optionDescriptions,
        defaultValue,
        hint,
        dependsOn,
        ...keep
      }) => keep
    );
  }
  return baseVariables;
}

// The locale entry the active tab edits (null on the default tab) and the
// typst its variables sync against: the locale's own source when present,
// otherwise the shared default source.
function activeLocaleContext(
  form: FormState,
  activeLocale: "default" | TemplateLocale
): { localeForm: LocaleForm | null; activeTypst: string } {
  if (activeLocale === "default") {
    return { localeForm: null, activeTypst: form.typstContent };
  }
  const localeForm = form.localizedContent[activeLocale] ?? EMPTY_LOCALE_FORM;
  return {
    localeForm,
    activeTypst: localeForm.typstContent.trim()
      ? localeForm.typstContent
      : form.typstContent,
  };
}

// Strip detector-only metadata (unused/typeMismatch) before persisting.
function stripFlags(list: MergedVariable[]): TemplateVariable[] {
  return list.map(({ unused, typeMismatch, ...v }) => v);
}

// Locale variable sets are re-merged against their own typst on save — same as
// the default set — so the panel and the persisted state can't diverge even if
// «Синхронизировать» was never pressed. A locale whose typst was cleared drops
// its now-orphaned variables (they were synced against the deleted source).
function buildLocalizedForSave(form: FormState): Record<string, LocaleForm> {
  const out: Record<string, LocaleForm> = {};
  for (const [locale, content] of Object.entries(form.localizedContent)) {
    if (content.typstContent.trim()) {
      const seed = resolveActiveStoredVariables(content, form.variables);
      out[locale] = {
        ...content,
        variables: stripFlags(
          mergeWithDetected(seed, detectVariables(content.typstContent))
        ),
      };
    } else {
      out[locale] = { ...content, variables: [] };
    }
  }
  return out;
}

// Write a variables list into the set the given tab owns: the shared default
// list, or the locale's own list inside its localizedContent entry.
function withVariables(
  prev: FormState,
  activeLocale: "default" | TemplateLocale,
  list: TemplateVariable[]
): FormState {
  if (activeLocale === "default") {
    return { ...prev, variables: list };
  }
  return {
    ...prev,
    localizedContent: {
      ...prev.localizedContent,
      [activeLocale]: {
        ...EMPTY_LOCALE_FORM,
        ...prev.localizedContent[activeLocale],
        variables: list,
      },
    },
  };
}

function rowToForm(row: TemplateRow): FormState {
  return {
    title: row.title,
    description: row.description ?? "",
    price: String(row.price),
    downloadPrice: String(row.downloadPrice),
    typstContent: row.typstContent,
    variables: Array.isArray(row.variables)
      ? (row.variables as TemplateVariable[])
      : [],
    isPublished: row.isPublished,
    categories: Array.isArray(row.categories) ? row.categories : [],
    documentType: row.documentType ?? "",
    localizedContent: Object.fromEntries(
      Object.entries(row.localizedContent ?? {}).map(([loc, content]) => [
        loc,
        {
          title: content?.title ?? "",
          description: content?.description ?? "",
          typstContent: content?.typstContent ?? "",
          variables: Array.isArray(content?.variables)
            ? (content.variables as TemplateVariable[])
            : [],
        },
      ])
    ),
  };
}

function AdminTemplatesPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listQuery = useQuery(trpc.adminTemplates.list.queryOptions());

  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewMaximized, setPreviewMaximized] = useState(false);
  // Which language version is being edited; "default" = the fallback fields.
  const [activeLocale, setActiveLocale] = useState<"default" | TemplateLocale>(
    "default"
  );

  const isDefaultLocale = activeLocale === "default";
  const activeContent = getActiveContent(form, activeLocale);
  const setActiveField = (
    field: Exclude<keyof LocaleForm, "variables">,
    value: string
  ) => setForm((prev) => applyLocaleField(prev, activeLocale, field, value));

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.adminTemplates.list.queryKey(),
    });
    // Public pages (catalogue/detail/builder) cache the same templates —
    // drop them too so an admin switching to the public view in this tab
    // sees the edit immediately, not a staleTime later.
    queryClient.invalidateQueries({
      queryKey: trpc.templates.list.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.templates.getById.queryKey(),
    });
  };

  const createMutation = useMutation(
    trpc.adminTemplates.create.mutationOptions({
      onSuccess: (result) => {
        toast.success("Шаблон создан");
        notifyCompileWarnings(result.compileWarnings);
        invalidate();
        closeForm();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.adminTemplates.update.mutationOptions({
      onSuccess: (result) => {
        toast.success("Шаблон обновлён");
        notifyCompileWarnings(result?.compileWarnings);
        invalidate();
        closeForm();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.adminTemplates.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Шаблон удалён");
        invalidate();
        setDeletingId(null);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setActiveLocale("default");
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (row: TemplateRow) => {
    setForm(rowToForm(row));
    setActiveLocale("default");
    setEditing(row);
    setCreating(false);
  };

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
  };

  // Variables being edited on the current tab. The default tab edits the
  // shared set; a locale tab edits that locale's own set (stored in its
  // localizedContent entry). A locale with its own typst seeds its first sync
  // from the default set minus the language-bound fields — those come from
  // the locale's typst comments instead.
  const { localeForm, activeTypst } = activeLocaleContext(form, activeLocale);
  const activeStoredVariables = useMemo<TemplateVariable[]>(
    () => resolveActiveStoredVariables(localeForm, form.variables),
    [localeForm, form.variables]
  );

  // Auto-sync variables with typst content. Result keeps user-edited fields
  // (label/required/dependsOn) but flags unused/typeMismatch.
  const mergedVariables: MergedVariable[] = useMemo(() => {
    const detected = detectVariables(activeTypst);
    return mergeWithDetected(activeStoredVariables, detected);
  }, [activeTypst, activeStoredVariables]);

  // The default set always goes into the save payload's `variables`, no matter
  // which tab is open.
  const defaultMergedVariables: MergedVariable[] = useMemo(() => {
    const detected = detectVariables(form.typstContent);
    return mergeWithDetected(form.variables, detected);
  }, [form.typstContent, form.variables]);

  // The button lights up whenever the merged view differs from what's stored
  // for this tab — new names, changed options/hints/labels from typst, or the
  // first fork of a locale set — not just on new variable names.
  const syncNeeded = useMemo(
    () =>
      JSON.stringify(stripFlags(mergedVariables)) !==
      JSON.stringify(activeStoredVariables),
    [mergedVariables, activeStoredVariables]
  );

  // Write the edited list to the set the current tab owns.
  const commitVariables = (list: TemplateVariable[]) => {
    setForm((prev) => withVariables(prev, activeLocale, list));
  };

  const syncVariablesFromTypst = () => {
    commitVariables(stripFlags(mergedVariables));
    toast.success(`Синхронизировано: ${mergedVariables.length} переменных`);
  };

  const handleVariableChange = (index: number, next: TemplateVariable) => {
    const list = stripFlags(mergedVariables);
    list[index] = next;
    commitVariables(list);
  };

  const handleVariableDelete = (index: number) => {
    const list = stripFlags(mergedVariables);
    list.splice(index, 1);
    commitVariables(list);
  };

  // Preview values: fill structural fields (select/boolean/number/date) with
  // defaults so conditional branches render; leave text/textarea empty so the
  // user sees the gray italic placeholder labels (matches the client builder).
  const previewValues = useMemo<Record<string, unknown>>(() => {
    const sample: Record<string, unknown> = {};
    for (const v of mergedVariables) {
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
  }, [mergedVariables]);

  const previewVariablesClean = useMemo(
    () => mergedVariables.map(({ unused, typeMismatch, ...v }) => v),
    [mergedVariables]
  );

  const toggleMaximize = () => setPreviewMaximized((v) => !v);

  const addManualVariable = () => {
    commitVariables([
      ...activeStoredVariables,
      {
        name: `var${activeStoredVariables.length + 1}`,
        type: "text",
        label: "",
        required: false,
      },
    ]);
  };

  const handleSubmit = () => {
    // Strip detector-only metadata before sending. The shared default set is
    // saved regardless of which language tab is open.
    const cleanVariables = stripFlags(defaultMergedVariables);
    const payload = {
      title: form.title,
      description: form.description || null,
      price: Number(form.price) || 0,
      downloadPrice: Number(form.downloadPrice) || 0,
      typstContent: form.typstContent,
      variables: cleanVariables as never,
      isPublished: form.isPublished,
      categories: form.categories,
      documentType: form.documentType || null,
      localizedContent: cleanLocalizedContent(
        buildLocalizedForSave(form)
      ) as never,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDialogOpen = creating || editing !== null;

  const unusedCount = mergedVariables.filter((v) => v.unused).length;
  const newDetectedCount = mergedVariables.filter(
    (v) => !activeStoredVariables.some((existing) => existing.name === v.name)
  ).length;

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-lg">Админка — шаблоны</h1>
          <p className="truncate text-muted-foreground text-sm">
            Создание и редактирование шаблонов документов
          </p>
        </div>
        <Button className="shrink-0" onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          Новый шаблон
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto p-6">
        {listQuery.isLoading && (
          <div className="text-muted-foreground text-sm">Загрузка...</div>
        )}
        {listQuery.data?.length === 0 && (
          <div className="text-muted-foreground text-sm">Шаблонов пока нет</div>
        )}
        {listQuery.data?.map((row) => (
          <div
            className="flex items-center justify-between rounded-lg border bg-card p-4"
            key={row.id}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{row.title}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    row.isPublished
                      ? "bg-green-100 text-green-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {row.isPublished ? "опубликован" : "черновик"}
                </span>
              </div>
              {row.description && (
                <p className="mt-1 truncate text-muted-foreground text-sm">
                  {row.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => openEdit(row as TemplateRow)}
                size="sm"
                variant="outline"
              >
                <Pencil className="mr-1.5 size-3.5" />
                Изменить
              </Button>
              <Button
                onClick={() => setDeletingId(row.id)}
                size="sm"
                variant="outline"
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog onOpenChange={(open) => !open && closeForm()} open={isDialogOpen}>
        <DialogContent className="!fixed !top-0 !left-0 !w-screen !h-screen !max-w-none !max-h-none !translate-x-0 !translate-y-0 !rounded-none sm:!max-w-none flex flex-col gap-0 overflow-hidden p-0">
          {/* Sticky toolbar — always visible at top */}
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-background px-6 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold text-base">
                {editing ? "Изменить шаблон" : "Новый шаблон"}
              </h2>
              <p className="truncate text-muted-foreground text-xs">
                Переменные определяются автоматически — нажми «Синхронизировать»
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button onClick={toggleMaximize} size="sm" variant="outline">
                {previewMaximized ? (
                  <>
                    <EyeOff className="mr-1.5 size-3.5" />
                    Показать редактор
                  </>
                ) : (
                  <>
                    <Eye className="mr-1.5 size-3.5" />
                    Развернуть превью
                  </>
                )}
              </Button>
              <Button onClick={closeForm} size="sm" variant="outline">
                Отмена
              </Button>
              <Button
                disabled={isSaving || !form.title || !form.typstContent}
                onClick={handleSubmit}
                size="sm"
              >
                {isSaving ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
          {/* Hidden a11y header for Radix */}
          <DialogHeader className="sr-only">
            <DialogTitle>
              {editing ? "Изменить шаблон" : "Новый шаблон"}
            </DialogTitle>
            <DialogDescription>
              Переменные определяются автоматически из текста.
            </DialogDescription>
          </DialogHeader>
          {/* Scrollable body */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6 pb-16">
            {/* Language version tabs — switch which version the fields edit */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">
                Язык версии:
              </span>
              {(["default", ...TEMPLATE_LOCALES] as const).map((loc) => {
                const isActive = activeLocale === loc;
                return (
                  <button
                    className={`inline-flex h-8 items-center rounded-lg border px-3 text-sm transition-colors ${
                      isActive
                        ? "border-foreground/40 bg-muted"
                        : "border-[#ececec] hover:border-foreground/30"
                    }`}
                    key={loc}
                    onClick={() => setActiveLocale(loc)}
                    type="button"
                  >
                    {loc === "default"
                      ? "По умолчанию"
                      : TEMPLATE_LOCALE_LABELS[loc]}
                  </button>
                );
              })}
              {!isDefaultLocale && (
                <span className="text-muted-foreground text-xs">
                  Пусто = берётся из «По умолчанию». Переменные у языка свои —
                  нажми «Синхронизировать» на этой вкладке.
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-[2fr_1fr]">
              <div className="grid gap-2">
                <Label htmlFor="title">Название</Label>
                <Input
                  id="title"
                  onChange={(e) => setActiveField("title", e.target.value)}
                  value={activeContent.title}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Описание</Label>
                <Input
                  id="description"
                  onChange={(e) =>
                    setActiveField("description", e.target.value)
                  }
                  value={activeContent.description}
                />
              </div>
              <div className="flex gap-3">
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="price">Цена редактирования</Label>
                  <Input
                    id="price"
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    type="number"
                    value={form.price}
                  />
                </div>
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="downloadPrice">Цена скачивания</Label>
                  <Input
                    id="downloadPrice"
                    onChange={(e) =>
                      setForm({ ...form, downloadPrice: e.target.value })
                    }
                    type="number"
                    value={form.downloadPrice}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <input
                    checked={form.isPublished}
                    className="size-4"
                    id="published"
                    onChange={(e) =>
                      setForm({ ...form, isPublished: e.target.checked })
                    }
                    type="checkbox"
                  />
                  <Label htmlFor="published">Опубликован</Label>
                </div>
              </div>
            </div>

            {/* Taxonomy: categories (cascading multi-select) + document type */}
            <div className="flex flex-wrap items-start gap-4 py-2">
              <div className="grid max-w-md gap-2">
                <Label>Категории</Label>
                <CategoryFilter
                  onChange={(next) => setForm({ ...form, categories: next })}
                  selected={form.categories}
                />
                {form.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.categories.map((slug) => (
                      <span
                        className="inline-flex items-center gap-1 rounded-md bg-muted py-1 pr-1 pl-2 text-foreground text-xs"
                        key={slug}
                      >
                        {CATEGORY_LABEL_BY_SLUG[slug] ?? slug}
                        <button
                          aria-label="Убрать категорию"
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setForm({
                              ...form,
                              categories: form.categories.filter(
                                (s) => s !== slug
                              ),
                            })
                          }
                          type="button"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="documentType">Вид документа</Label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-foreground/30"
                  id="documentType"
                  onChange={(e) =>
                    setForm({ ...form, documentType: e.target.value })
                  }
                  value={form.documentType}
                >
                  <option value="">— не указан —</option>
                  {DOCUMENT_TYPE_VALUES.map((type) => (
                    <option key={type} value={type}>
                      {DOCUMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              className={`grid min-h-[75vh] grid-cols-1 gap-4 ${
                previewMaximized ? "" : "sm:grid-cols-2"
              }`}
            >
              {/* Left: Typst editor (top) + Variables (below) — equal halves.
                  Hidden when preview is maximized. */}
              {!previewMaximized && (
                <div className="flex h-[80vh] min-h-0 flex-col gap-4">
                  {/* Typst editor */}
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <Label htmlFor="typst">Typst-контент</Label>
                    <Textarea
                      className="min-h-0 flex-1 resize-none font-mono text-xs"
                      id="typst"
                      onChange={(e) =>
                        setActiveField("typstContent", e.target.value)
                      }
                      placeholder="#set page(...)&#10;{{variableName}} ..."
                      value={activeContent.typstContent}
                    />
                    <CompileStatusBanner
                      typstContent={activeContent.typstContent}
                      variables={mergedVariables}
                    />
                  </div>

                  {/* Variables panel */}
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label>Переменные ({mergedVariables.length})</Label>
                      <Button
                        disabled={!syncNeeded}
                        onClick={syncVariablesFromTypst}
                        size="sm"
                        variant="outline"
                      >
                        Синхронизировать
                        {newDetectedCount > 0 && ` (+${newDetectedCount})`}
                      </Button>
                    </div>
                    {unusedCount > 0 && (
                      <p className="text-destructive text-xs">
                        ⚠️ {unusedCount} переменных не используется в шаблоне
                      </p>
                    )}
                    <div className="min-h-0 flex-1 space-y-2 overflow-auto rounded border bg-muted/20 p-2">
                      {mergedVariables.length === 0 && (
                        <p className="px-2 py-4 text-center text-muted-foreground text-xs">
                          Переменные появятся здесь по мере набора Typst-кода
                          (плейсхолдеры вида {"{{name}}"}).
                        </p>
                      )}
                      {mergedVariables.map((v, i) => (
                        <VariableCard
                          allVariables={mergedVariables}
                          // biome-ignore lint/suspicious/noArrayIndexKey: a variable's identity is its position within a tab (edits/deletes go by index; keying by the editable `name` would remount on every keystroke). The locale prefix remounts cards on tab switch — variable names repeat across locales, and a stale card buffer would leak one language's options into another.
                          key={`${activeLocale}-${i}`}
                          onChange={(next) => handleVariableChange(i, next)}
                          onDelete={() => handleVariableDelete(i)}
                          variable={v}
                        />
                      ))}
                    </div>
                    <Button
                      onClick={addManualVariable}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Plus className="mr-1.5 size-3.5" />
                      Добавить вручную
                    </Button>
                  </div>
                </div>
              )}

              {/* Right: Preview — always shown */}
              <div className="flex min-h-0 flex-col gap-2">
                <Label className="text-base">Предпросмотр документа</Label>
                <p className="text-muted-foreground text-xs">
                  Обновляется в реальном времени. Подставлены значения по
                  умолчанию (или плейсхолдеры «[Label]» если defaultValue не
                  задан).
                </p>
                <div
                  className={`overflow-hidden rounded border ${
                    previewMaximized
                      ? "mx-auto h-[95vh] w-full max-w-5xl"
                      : "h-[90vh]"
                  }`}
                >
                  {activeContent.typstContent ? (
                    <AdminDocumentPreview
                      previewValues={previewValues}
                      typstContent={activeContent.typstContent}
                      variables={previewVariablesClean}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                      Введите Typst-контент, чтобы увидеть предпросмотр
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>{" "}
          {/* end scrollable body */}
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => !open && setDeletingId(null)}
        open={deletingId !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить шаблон?</AlertDialogTitle>
            <AlertDialogDescription>
              Действие необратимо. Все версии шаблона тоже будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() =>
                deletingId && deleteMutation.mutate({ id: deletingId })
              }
            >
              {deleteMutation.isPending ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
