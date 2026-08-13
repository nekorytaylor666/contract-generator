import {
  resolveLocalized,
  resolveLocalizedVariables,
} from "@contract-builder/api/constants/template-options";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  DownloadIcon,
  Info,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Share,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LawyerReviewDialog } from "@/components/lawyer-review-dialog";
import { HeaderSignOut } from "@/components/sidebar-layout";
import {
  type DocumentStyle,
  DocumentStyleSettings,
} from "@/components/template-builder/document-style-settings";
import { InteractiveDocumentPreview } from "@/components/template-builder/interactive-document-preview";
import { LogoUpload } from "@/components/template-builder/logo-upload";
import { NativeForm } from "@/components/template-builder/native-form";
import { NativeInlinePreview } from "@/components/template-builder/native-inline-preview";
import { PreviewErrorBoundary } from "@/components/template-builder/preview-error-boundary";
import { isComplexNative } from "@/components/template-builder/server-typst-preview";
import { VersionHistory } from "@/components/template-builder/version-history";
import { TemplateInfoDialog } from "@/components/template-info-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { requireAuth } from "@/lib/auth-guard";
import {
  collectPartyBindings,
  extractCounterpartyDraft,
} from "@/lib/counterparty-prefill";
import { remapValuesForLocale } from "@/lib/locale-values";
import { isNativeTypst, parseNativeLets } from "@/lib/native-typst";
import { cn } from "@/lib/utils";
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

// Loose equality over form values — the seeded-vs-current check must not be
// tripped by representation drift (Date vs ISO string, "" vs undefined).
function sameValues(
  a: Record<string, unknown> | null,
  b: Record<string, unknown> | null
): boolean {
  const left = a ?? {};
  const right = b ?? {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (String(left[key] ?? "") !== String(right[key] ?? "")) {
      return false;
    }
  }
  return true;
}

// Merge template defaults into values for fields the user has never seen —
// existing input wins. Returns null when nothing new was gained.
function backfillNewFields(
  current: Record<string, unknown>,
  defaults: Record<string, unknown>
): Record<string, unknown> | null {
  let gained = false;
  const merged = { ...current };
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in current)) {
      merged[key] = value;
      gained = true;
    }
  }
  return gained ? merged : null;
}

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

/** Индикатор в шапке: «Скачан» / «Сохранение…» / кнопка / «Сохранено». */
function SaveStatus({
  docLocked,
  saving,
  hasChanges,
  canEdit,
  onSave,
}: {
  docLocked: boolean;
  saving: boolean;
  hasChanges: boolean;
  canEdit: boolean;
  onSave: () => void;
}) {
  if (docLocked) {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
        <DownloadIcon className="size-4" />
        Скачан — правки закрыты
      </span>
    );
  }
  if (saving) {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Сохранение…
      </span>
    );
  }
  if (hasChanges) {
    return (
      <Button disabled={!canEdit} onClick={onSave} size="sm" variant="outline">
        Сохранить
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
      <Check className="size-4 text-green-600" />
      Сохранено
    </span>
  );
}

// Название договора в хлебных крошках: клик — инлайн-редактирование,
// Enter/blur сохраняет, Escape отменяет.
function EditableDocTitle({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onCommit(trimmed);
    }
  };

  if (!editing) {
    return (
      <button
        className="group/title flex min-w-0 items-center gap-1.5 text-left"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        title="Переименовать договор"
        type="button"
      >
        <span className="truncate font-medium text-foreground">{value}</span>
        <PenLine className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100" />
      </button>
    );
  }
  return (
    <input
      className="w-[280px] min-w-0 rounded-md border border-border bg-background px-2 py-0.5 font-medium text-foreground text-sm outline-none focus:border-ring"
      onBlur={commit}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
        } else if (e.key === "Escape") {
          setEditing(false);
        }
      }}
      ref={inputRef}
      value={draft}
    />
  );
}

// Месяцы для «Обновится 1 …» в тултипе лимита проверок.
const REVIEW_RESET_MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** Кнопка «На проверку юристу» (по макету): активна при остатке квоты
 * проверок тарифа; при исчерпании — задизейблена с тултипом о дате сброса. */
function LawyerReviewButton({
  isPaid,
  loading,
  quota,
  remaining,
  onOpen,
}: {
  isPaid: boolean;
  loading: boolean;
  quota: number;
  remaining: number;
  onOpen: () => void;
}) {
  const available = remaining === -1 || remaining > 0;
  if (available) {
    return (
      <button
        className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 font-medium text-foreground text-sm transition-colors hover:bg-muted"
        onClick={onOpen}
        type="button"
      >
        <Share className="size-4" />
        <span className="hidden sm:inline">На проверку юристу</span>
      </button>
    );
  }
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  // Пока тариф не загрузился, квоты ещё нули — кнопку блокируем, но подсказку
  // не показываем, иначе платный подписчик видит «доступна на платных тарифах».
  let hint: string | null = null;
  if (!loading) {
    if (isPaid) {
      hint =
        quota === 0
          ? "Проверка юриста не входит в ваш тариф"
          : `Лимит проверок исчерпан. Обновится 1 ${REVIEW_RESET_MONTHS[nextMonth.getMonth()]}`;
    } else {
      hint = "Проверка юриста доступна на платных тарифах";
    }
  }
  const disabledButton = (
    <button
      className="pointer-events-none inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 font-medium text-foreground text-sm opacity-50"
      disabled
      type="button"
    >
      <Share className="size-4" />
      <span className="hidden sm:inline">На проверку юристу</span>
    </button>
  );
  if (!hint) {
    return disabledButton;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{disabledButton}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[200px] text-center">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

// Классы панелей конструктора. Ниже lg документ занимает весь экран, а форма
// живёт в выдвижной шторке снизу (не размонтируется — только translate, чтобы
// не пересобирать форму и не терять скролл документа). На десктопе — прежние
// две колонки, форма по sidebarOpen.
function paneClasses(formSheetOpen: boolean, sidebarOpen: boolean) {
  return {
    // overflow-hidden, а не auto: скроллит внутренний контейнер превью — его
    // же использует авто-прокрутка к последнему изменённому полю.
    doc: "min-h-0 flex-1 overflow-hidden bg-muted/30 p-4",
    form: cn(
      "fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-2xl border-border border-t bg-background shadow-[0_-12px_40px_rgba(0,0,0,0.16)] transition-transform duration-300",
      formSheetOpen ? "translate-y-0" : "translate-y-full",
      "lg:static lg:z-auto lg:max-h-none lg:w-96 lg:shrink-0 lg:translate-y-0 lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none lg:transition-none",
      sidebarOpen ? "lg:flex" : "lg:hidden"
    ),
  };
}

/** Подложка открытой мобильной шторки формы либо плавающая кнопка её
 * открытия — оба элемента существуют только ниже lg. */
function MobileSheetControls({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  if (open) {
    // Тап по затемнённому документу за шторкой закрывает её.
    return (
      <button
        aria-label="Закрыть заполнение"
        className="fixed inset-0 z-30 cursor-default bg-black/40 lg:hidden"
        onClick={() => onToggle(false)}
        type="button"
      />
    );
  }
  return (
    <button
      className="fixed inset-x-4 bottom-4 z-20 flex h-12 items-center justify-center gap-2 rounded-full bg-primary font-medium text-primary-foreground text-sm shadow-lg transition-colors hover:bg-primary/90 lg:hidden"
      onClick={() => onToggle(true)}
      type="button"
    >
      <PenLine className="size-4" />
      Заполнить данные
    </button>
  );
}

function RouteComponent() {
  const { templateId } = Route.useParams();
  const { documentId: initialDocumentId } = Route.useSearch();
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const [lawyerOpen, setLawyerOpen] = useState(false);
  const { data: myAccess } = useQuery(trpc.team.myAccess.queryOptions());
  const canEdit = myAccess?.canEdit !== false;
  // Гейт пикеров/автосейва контрагентов — любой тариф, кроме разового.
  const { data: mySubscription } = useQuery(
    trpc.subscriptions.mySubscription.queryOptions()
  );
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
  // Кастомное название договора (null — ещё не задано, показываем название
  // шаблона на языке договора).
  const [docTitle, setDocTitle] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [formKey, setFormKey] = useState(0);
  const [initialValues, setInitialValues] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Мобильный конструктор: форма — выдвижная шторка поверх документа, чтобы
  // не листать десятистраничный договор туда-сюда. Стартуем с открытой:
  // заполнение и есть основная задача, документ — в одном тапе по крестику.
  const [formSheetOpen, setFormSheetOpen] = useState(true);
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
  const { data: existingDocument, error: documentLoadError } = useQuery({
    ...trpc.documents.getById.queryOptions({ id: documentId ?? "" }),
    enabled: !!documentId,
  });

  // Скачанный договор закрыт для правок: сервер отклонит save, а в шапке
  // вместо «Сохранить» показываем пометку.
  const docLocked = Boolean(existingDocument?.downloadedAt);

  // Документ из URL недоступен (удалён или лежит в другой организации) —
  // сбрасываем documentId и работаем как с новым документом. Иначе каждое
  // сохранение уходило бы в update-ветку и падало с «Document not found».
  useEffect(() => {
    if (!(documentLoadError && documentId)) {
      return;
    }
    setDocumentId(undefined);
    navigate({
      to: "/templates/$templateId/builder",
      params: { templateId },
      search: {},
      replace: true,
    });
  }, [documentLoadError, documentId, navigate, templateId]);

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
    setDocTitle(existingDocument.title);
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
  // Keyed by id + updatedAt: on SPA navigation the stale cached template
  // paints first and seeds the form, then the forced refetch delivers the
  // admin's fresh edits — keying by id alone left the new defaults invisible
  // ("the template never updates"). Language switches don't reseed (the key
  // ignores locale), and values the user has already typed are never
  // clobbered — a touched form only backfills fields it has never seen.
  const defaultsInitRef = useRef<string | null>(null);
  const seededDefaultsRef = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!template || initialValues || existingDocument) {
      return;
    }
    const seedKey = `${template.id}:${String(template.updatedAt ?? "")}`;
    if (defaultsInitRef.current === seedKey) {
      return;
    }
    const isReseed =
      defaultsInitRef.current?.startsWith(`${template.id}:`) ?? false;
    defaultsInitRef.current = seedKey;
    if (
      isReseed &&
      !sameValues(latestValuesRef.current, seededDefaultsRef.current)
    ) {
      // The user typed while the fresh template was in flight — keep their
      // input, only pick up defaults for fields added since the stale seed.
      const merged = backfillNewFields(
        latestValuesRef.current ?? {},
        templateDefaults
      );
      if (merged) {
        setFormValues(merged);
        latestValuesRef.current = merged;
        setFormKey((k) => k + 1);
      }
      return;
    }
    seededDefaultsRef.current = templateDefaults;
    setFormValues(templateDefaults);
    latestValuesRef.current = templateDefaults;
    if (isReseed) {
      // TanStack Form reads initial values on mount only — remount it.
      setFormKey((k) => k + 1);
    }
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
        link.href = data.dataUrl;
        link.download = data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Сервер пометил документ скачанным — обновляем его и список, чтобы
        // блокировка редактирования появилась сразу, без перезагрузки.
        if (documentId) {
          queryClient.invalidateQueries({
            queryKey: trpc.documents.getById.queryKey({ id: documentId }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.documents.list.queryKey(),
          });
        }
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const autosaveMutation = useMutation(
    trpc.counterparties.autosave.mutationOptions()
  );

  // Автосохранение контрагентов из заполненных секций сторон (по макету:
  // «при заполнении договора — реквизиты сохранятся автоматически»).
  // Дедупликацию по БИН делает сервер; сбой не ломает сохранение договора.
  const runCounterpartyAutosave = useCallback(async () => {
    const values = latestValuesRef.current;
    if (!(template && values && mySubscription?.isPaid)) {
      return;
    }
    const { typstContent } = resolveLocalized(
      {
        title: template.title,
        description: template.description,
        typstContent: template.typstContent,
      },
      template.localizedContent,
      docLocale
    );
    const parties = collectPartyBindings(
      typstContent,
      variablesForLocale(template, docLocale)
    );
    for (const party of parties) {
      const draft = extractCounterpartyDraft(party.mapping, values);
      if (!draft) {
        continue;
      }
      try {
        const result = await autosaveMutation.mutateAsync(draft);
        if (result.created) {
          toast.success(`Контрагент «${draft.name}» сохранён в справочник`);
          queryClient.invalidateQueries(trpc.counterparties.list.queryFilter());
        }
        if (values[party.storageKey] !== result.id) {
          formApiRef.current?.setFieldValue(party.storageKey, result.id);
        }
      } catch {
        // Сохранение договора важнее — сбой автосейва глотаем молча.
      }
    }
  }, [
    template,
    docLocale,
    mySubscription,
    autosaveMutation.mutateAsync,
    queryClient,
    trpc,
  ]);

  const saveMutation = useMutation(
    trpc.documents.save.mutationOptions({
      onSuccess: (data) => {
        setDocumentId(data.id);
        setCurrentVersion(data.version);
        runCounterpartyAutosave();
        // Создание документа списывает квоту редактирования — обновляем
        // виджет «Использование» в сайдбаре.
        queryClient.invalidateQueries(
          trpc.subscriptions.mySubscription.queryFilter()
        );
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
      // Без обработчика отказ сохранения (например, «Лимит редактирований
      // исчерпан») проглатывался молча, а шапка показывала «Сохранено».
      onError: (err) => toast.error(err.message),
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

  const handleDownload = useCallback(
    (format: "pdf" | "docx") => {
      if (!latestValuesRef.current) {
        return;
      }
      // Always compile the LIVE template — the on-screen preview and the form
      // already render it, so the downloaded PDF must match. Pinning the
      // document's templateVersionId here served week-old snapshots after every
      // admin edit ("the template never updates").
      compileMutation.mutate({
        templateId,
        // Скачивание сохранённого документа сервер зафиксирует и закроет его
        // для дальнейших правок.
        documentId,
        locale: docLocale,
        variables: latestValuesRef.current,
        logo: logo ?? undefined,
        format,
        style: {
          font: documentStyle.font,
          preset: documentStyle.preset,
        },
      });
    },
    [
      templateId,
      documentId,
      compileMutation.mutate,
      logo,
      documentStyle,
      docLocale,
    ]
  );

  // «На проверку юристу»: тот же набор данных, что и при скачивании, — юрист
  // получает PDF ровно той версии, которую пользователь видит в конструкторе.
  const buildLawyerPayload = useCallback(
    () =>
      latestValuesRef.current
        ? {
            templateId,
            documentId,
            locale: docLocale,
            variables: latestValuesRef.current,
            logo: logo ?? undefined,
            style: {
              font: documentStyle.font,
              preset: documentStyle.preset,
            },
          }
        : null,
    [templateId, documentId, docLocale, logo, documentStyle]
  );

  const renameMutation = useMutation(
    trpc.documents.rename.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.documents.list.queryKey(),
        });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const handleTitleCommit = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (!trimmed) {
        return;
      }
      setDocTitle(trimmed);
      // Существующий документ переименовываем сразу; новый получит название
      // при первом сохранении (documents.save принимает title).
      if (documentId) {
        renameMutation.mutate({ documentId, title: trimmed });
      }
    },
    [documentId, renameMutation.mutate]
  );

  const handleSave = useCallback(() => {
    if (docLocked || !(canEdit && latestValuesRef.current)) {
      return;
    }
    saveMutation.mutate({
      documentId: documentId ?? undefined,
      templateId,
      title: docTitle ?? undefined,
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
    docLocked,
    docLocale,
    docTitle,
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

  const panes = paneClasses(formSheetOpen, sidebarOpen);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header: на узких экранах кнопки переносятся под хлебные крошки */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-border border-b bg-background px-4 py-3">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            to="/documents"
          >
            Мои документы
          </Link>
          <span className="text-muted-foreground">/</span>
          <EditableDocTitle
            onCommit={handleTitleCommit}
            value={docTitle ?? localized.title}
          />
          <button
            aria-label="О договоре"
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
            onClick={() => setInfoOpen(true)}
            type="button"
          >
            <Info className="size-4" />
          </button>
          <TemplateInfoDialog
            onOpenChange={setInfoOpen}
            open={infoOpen}
            templateId={templateId}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:gap-3">
          <SaveStatus
            canEdit={canEdit}
            docLocked={docLocked}
            hasChanges={changedVars.size > 0}
            onSave={handleSave}
            saving={saveMutation.isPending}
          />
          <LawyerReviewButton
            isPaid={mySubscription?.isPaid ?? false}
            loading={!mySubscription}
            onOpen={() => setLawyerOpen(true)}
            quota={mySubscription?.reviewQuota ?? 0}
            remaining={mySubscription?.reviewRemaining ?? 0}
          />
          <LawyerReviewDialog
            buildPayload={buildLawyerPayload}
            onOpenChange={setLawyerOpen}
            open={lawyerOpen}
            userEmail={session.user.email}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-tour="download"
                disabled={compileMutation.isPending}
              >
                {compileMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <DownloadIcon className="size-4" />
                )}
                {compileMutation.isPending ? (
                  "Скачивание…"
                ) : (
                  <>
                    <span className="hidden sm:inline">Скачать договор</span>
                    <span className="sm:hidden">Скачать</span>
                  </>
                )}
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onSelect={() => handleDownload("docx")}>
                <DownloadIcon className="size-4" />
                Скачать в DocX
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleDownload("pdf")}>
                <DownloadIcon className="size-4" />
                Скачать в PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Язык интерфейса и выход — по макету в шапке конструктора
              (на мобильных их уже показывает панель приложения). */}
          <div className="hidden items-center gap-3 md:flex">
            <LanguageSwitcher />
            <HeaderSignOut />
          </div>
        </div>
      </div>

      {/* Toolbar: селекты стиля не влезают на мобильных — скроллим по горизонтали */}
      <div className="flex items-center gap-3 overflow-x-auto border-border border-b bg-background px-4 py-2">
        <DocumentStyleSettings
          locale={docLocale}
          onLocaleChange={handleLocaleChange}
          onStyleChange={handleStyleChange}
          style={documentStyle}
        />
        {/* Сворачивание панели — только десктоп: на мобильных панелями
            управляет переключатель «Данные | Документ» */}
        <div className="ml-auto hidden lg:block">
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

      {/* Content: ниже lg — документ на весь экран + шторка формы поверх,
          на десктопе — две независимо скроллящиеся колонки */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Interactive Document Preview */}
        <div className={panes.doc}>
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

        <MobileSheetControls onToggle={setFormSheetOpen} open={formSheetOpen} />

        {/* Form Sidebar — на десктопе колонка (сворачивается кнопкой), ниже lg —
            выдвижная шторка поверх документа. Рендерится всегда: закрытие — это
            translate, форма не пересобирается и позиции скролла не теряются. */}
        <div className={panes.form} data-tour="builder-form">
          {/* Шапка шторки — только мобильная */}
          <div className="flex items-center justify-between border-border border-b px-4 py-3 lg:hidden">
            <span className="font-medium text-foreground text-sm">
              Заполнение данных
            </span>
            <button
              aria-label="Показать документ"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setFormSheetOpen(false)}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
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
        </div>
      </div>
    </div>
  );
}
