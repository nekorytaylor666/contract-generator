import { expandCategorySelection } from "@contract-builder/api/constants/template-options";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  Clock,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DocumentCard } from "@/components/document-card";
import {
  documentStatusLabel,
  normalizeDocumentStatus,
  SETTABLE_STATUSES,
} from "@/components/document-status";
import { PaginationControls } from "@/components/pagination-controls";
import {
  type SearchSuggestion,
  SearchWithSuggestions,
} from "@/components/search-with-suggestions";
import { TemplateCard } from "@/components/template-card";
import { CategoryFilter } from "@/components/templates/category-filter";
import { DocumentTypeFilter } from "@/components/templates/document-type-filter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { requireAuth } from "@/lib/auth-guard";
import { looksLikePhone } from "@/lib/display-name";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/documents")({
  component: RouteComponent,
  beforeLoad: async () => {
    const { session, organizations } = await requireAuth();
    return { session, organizations };
  },
});

const SORT_KEYS = ["new", "old", "title"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const SORT_LABELS: Record<SortKey, string> = {
  new: "Сначала новые",
  old: "Сначала старые",
  title: "По названию",
};

function toTime(value: Date | string): number {
  return new Date(value).getTime();
}

function sortDocuments<T extends { title: string; updatedAt: Date | string }>(
  list: T[],
  sort: SortKey
): T[] {
  const copy = [...list];
  if (sort === "title") {
    return copy.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  }
  if (sort === "old") {
    return copy.sort((a, b) => toTime(a.updatedAt) - toTime(b.updatedAt));
  }
  return copy.sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt));
}

const DOC_TABS = [
  { id: "all", label: "Все договора" },
  { id: "saved", label: "Сохранённые" },
  { id: "drafts", label: "Черновики" },
  { id: "completed", label: "Завершённые" },
] as const;
type DocTab = (typeof DOC_TABS)[number]["id"];

const PAGE_SIZE = 12;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const STATS_WINDOW_DAYS = 30;

// Финальные статусы для вкладки «Завершённые».
const COMPLETED_STATUSES = new Set(["signed", "expired", "terminated"]);
// «В работе» на дашборде: черновики и ожидающие.
const IN_WORK_STATUSES = new Set([
  "draft",
  "in_progress",
  "awaiting_signature",
]);
const PERCENT = 100;

interface DocumentListItem {
  id: string;
  title: string;
  templateId: string;
  templateTitle: string | null;
  status: string;
  updatedAt: Date | string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
      <span className="flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="size-4" />
        {label}
      </span>
      <span className="font-semibold text-3xl text-foreground leading-none">
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{hint}</span>
    </div>
  );
}

function RouteComponent() {
  const { t, i18n } = useTranslation();
  const trpc = useTRPC();
  const { data: documents = [], isLoading } = useQuery({
    ...trpc.documents.list.queryOptions({ locale: i18n.language }),
    refetchOnMount: "always",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("new");
  const [tab, setTab] = useState<DocTab>("all");

  // Смена статуса карточек доступна на любой подписке, кроме разовой.
  const { data: mySubscription } = useQuery(
    trpc.subscriptions.mySubscription.queryOptions()
  );
  const canChangeStatus = Boolean(mySubscription?.isPaid);

  const visibleDocuments = useMemo(() => {
    let list = documents;
    if (tab === "drafts") {
      list = list.filter(
        (doc) => normalizeDocumentStatus(doc.status) === "draft"
      );
    } else if (tab === "completed") {
      list = list.filter((doc) =>
        COMPLETED_STATUSES.has(normalizeDocumentStatus(doc.status))
      );
    }
    if (selectedStatuses.length > 0) {
      const set = new Set(selectedStatuses);
      list = list.filter((doc) => set.has(normalizeDocumentStatus(doc.status)));
    }
    if (selectedCategories.length > 0) {
      // Выбор в фильтре — на уровне подкатегорий, документы размечены
      // листовыми слагами: раскрываем выбор до потомков.
      const set = new Set(expandCategorySelection(selectedCategories));
      list = list.filter((doc) =>
        (doc.categories ?? []).some((slug) => set.has(slug))
      );
    }
    if (selectedDocTypes.length > 0) {
      const set = new Set(selectedDocTypes);
      list = list.filter(
        (doc) => doc.documentType != null && set.has(doc.documentType)
      );
    }
    if (searchQuery.trim()) {
      list = fuzzySearch(searchQuery, list, (doc) => [
        doc.title,
        doc.templateTitle,
        doc.authorName,
      ]).map((result) => result.item);
    }
    return sortDocuments(list, sort);
  }, [
    documents,
    tab,
    selectedCategories,
    selectedDocTypes,
    selectedStatuses,
    searchQuery,
    sort,
  ]);

  // Дашборд «как в макете»: всего / подписано / в работе / за 30 дней.
  const stats = useMemo(() => {
    const total = documents.length;
    let signed = 0;
    let inWork = 0;
    let last30 = 0;
    let previous30 = 0;
    const now = Date.now();
    const windowMs = STATS_WINDOW_DAYS * MILLIS_PER_DAY;
    for (const doc of documents) {
      const status = normalizeDocumentStatus(doc.status);
      if (status === "signed") {
        signed += 1;
      }
      if (IN_WORK_STATUSES.has(status)) {
        inWork += 1;
      }
      const age = now - toTime(doc.createdAt);
      if (age <= windowMs) {
        last30 += 1;
      } else if (age <= windowMs * 2) {
        previous30 += 1;
      }
    }
    return {
      total,
      signed,
      signedPct: total > 0 ? Math.round((signed / total) * PERCENT) : 0,
      inWork,
      last30,
      delta: last30 - previous30,
    };
  }, [documents]);

  const hasFilters =
    searchQuery.trim().length > 0 ||
    selectedCategories.length > 0 ||
    selectedDocTypes.length > 0 ||
    selectedStatuses.length > 0;

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategories([]);
    setSelectedDocTypes([]);
    setSelectedStatuses([]);
  };

  // Client-side pagination over the filtered list.
  const [page, setPage] = useState(1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [
    searchQuery,
    selectedCategories,
    selectedDocTypes,
    selectedStatuses,
    sort,
    tab,
  ]);
  const pageCount = Math.max(1, Math.ceil(visibleDocuments.length / PAGE_SIZE));
  const pagedDocuments = visibleDocuments.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const searchSuggestions = useMemo<SearchSuggestion[]>(
    () =>
      documents.map((doc) => ({
        id: doc.id,
        label: doc.title,
        sublabel: doc.templateTitle ?? doc.authorName ?? undefined,
      })),
    [documents]
  );

  const { data: activeOrg } = authClient.useActiveOrganization();
  // Phone-only accounts have an org named after the phone number — show a
  // generic title instead of leaking the number.
  const orgName =
    activeOrg?.name && !looksLikePhone(activeOrg.name)
      ? activeOrg.name
      : t("nav.documents");

  // Saved templates the user bookmarked — shown in the "Сохранённые" tab. They
  // aren't documents/purchases; the user can just open and view them.
  const { data: allTemplates = [] } = useQuery(
    trpc.templates.list.queryOptions({ locale: i18n.language })
  );
  const { data: bookmarks = [] } = useQuery(
    trpc.templates.myBookmarks.queryOptions()
  );
  const savedTemplates = useMemo(() => {
    const ids = new Set(bookmarks);
    let list = allTemplates.filter((tpl) => ids.has(tpl.id));
    if (searchQuery.trim()) {
      list = fuzzySearch(searchQuery, list, (tpl) => [
        tpl.title,
        tpl.description,
      ]).map((r) => r.item);
    }
    return list;
  }, [allTemplates, bookmarks, searchQuery]);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex flex-col gap-4 p-6">
        {/* Heading */}
        <div className="flex flex-col gap-0.5">
          <h1 className="font-semibold text-2xl text-foreground leading-7">
            {orgName}
          </h1>
          <h2 className="font-medium text-lg text-muted-foreground">
            {t("documents.subtitle")}
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-border border-b">
          {DOC_TABS.map((docTab) => {
            const isActive = tab === docTab.id;
            return (
              <button
                className={cn(
                  "-mb-px border-b pb-2 transition-colors",
                  isActive ? "border-foreground" : "border-transparent"
                )}
                key={docTab.id}
                onClick={() => setTab(docTab.id)}
                type="button"
              >
                <span
                  className={cn(
                    "inline-flex min-h-[29px] items-center rounded-md px-2 py-1 text-sm leading-[18px] transition-colors",
                    isActive
                      ? "border border-border text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {docTab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Dashboard (по макету: всего / подписано / в работе / за 30 дней) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            hint="За всё время"
            icon={FileText}
            label="Всего договоров"
            value={stats.total}
          />
          <StatCard
            hint={`${stats.signedPct}% от всех`}
            icon={CircleCheck}
            label="Подписано"
            value={stats.signed}
          />
          <StatCard
            hint="Черновики и ожидающие"
            icon={Clock}
            label="В работе"
            value={stats.inWork}
          />
          <StatCard
            hint={`${stats.delta >= 0 ? "+" : ""}${stats.delta} к прошлому месяцу`}
            icon={CalendarDays}
            label="За 30 дней"
            value={stats.last30}
          />
        </div>

        {/* Search */}
        <SearchWithSuggestions
          ariaLabel={t("documents.searchPlaceholder")}
          iconClassName="size-5"
          inputClassName="pl-12 text-base"
          onSelectSuggestion={(suggestion) => setSearchQuery(suggestion.label)}
          onValueChange={setSearchQuery}
          placeholder={t("documents.searchPlaceholder")}
          suggestions={searchSuggestions}
          value={searchQuery}
        />

        {/* Filters + sort — document filters only (hidden on the saved tab) */}
        {tab !== "saved" && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryFilter
                onChange={setSelectedCategories}
                selected={selectedCategories}
              />
              <DocumentTypeFilter
                onChange={setSelectedDocTypes}
                selected={selectedDocTypes}
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#ececec] px-3 text-foreground text-sm outline-none hover:border-foreground/30",
                    selectedStatuses.length > 0 && "border-foreground/40"
                  )}
                >
                  {t("documents.filters.status")}
                  {selectedStatuses.length > 0 && (
                    <span className="rounded-full bg-muted px-1.5 text-xs">
                      {selectedStatuses.length}
                    </span>
                  )}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-[180px]">
                  {SETTABLE_STATUSES.map((value) => {
                    const active = selectedStatuses.includes(value);
                    return (
                      <DropdownMenuItem
                        className="justify-between"
                        key={value}
                        onSelect={(e) => {
                          // Не закрываем меню — фильтр множественный.
                          e.preventDefault();
                          setSelectedStatuses((prev) =>
                            active
                              ? prev.filter((s) => s !== value)
                              : [...prev, value]
                          );
                        }}
                      >
                        {documentStatusLabel(value)}
                        {active && <Check className="size-4" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              {hasFilters && (
                <button
                  className="px-2 text-muted-foreground text-xs hover:text-foreground"
                  onClick={resetFilters}
                  type="button"
                >
                  {t("common.reset")}
                </button>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#e5e5e5] py-2 pr-2 pl-3 text-foreground text-sm outline-none hover:border-foreground/30">
                {t("common.sort")}
                <ChevronDown className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                {SORT_KEYS.map((key) => (
                  <DropdownMenuItem
                    className={cn(
                      "justify-between",
                      key === sort && "bg-muted"
                    )}
                    key={key}
                    onSelect={() => setSort(key)}
                  >
                    {SORT_LABELS[key]}
                    {key === sort && <Check className="size-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Grid */}
        {tab === "saved" ? (
          <SavedTemplatesGrid templates={savedTemplates} />
        ) : (
          <>
            {renderGrid({
              canChangeStatus,
              documents: pagedDocuments,
              hasDocuments: documents.length > 0,
              isLoading,
              t,
            })}
            <PaginationControls
              onPageChange={setPage}
              page={page}
              pageCount={pageCount}
            />
          </>
        )}
      </div>
    </div>
  );
}

function renderGrid({
  canChangeStatus,
  documents,
  hasDocuments,
  isLoading,
  t,
}: {
  canChangeStatus: boolean;
  documents: DocumentListItem[];
  hasDocuments: boolean;
  isLoading: boolean;
  t: TFunction;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        {t("documents.loading")}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileText className="mb-3 size-12 text-muted-foreground/30" />
        <p className="font-medium text-foreground text-sm">
          {hasDocuments ? t("documents.notFound") : t("documents.empty")}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          {hasDocuments
            ? t("documents.notFoundHint")
            : t("documents.emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {documents.map((doc) => (
        <DocumentCard
          canChangeStatus={canChangeStatus}
          id={doc.id}
          key={doc.id}
          status={doc.status}
          templateId={doc.templateId}
          templateTitle={doc.templateTitle}
          title={doc.title}
          updatedAt={doc.updatedAt}
        />
      ))}
    </div>
  );
}

interface SavedTemplate {
  id: string;
  title: string;
  description: string | null;
  price: number;
}

function SavedTemplatesGrid({ templates }: { templates: SavedTemplate[] }) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileText className="mb-3 size-12 text-muted-foreground/30" />
        <p className="font-medium text-foreground text-sm">
          Нет сохранённых шаблонов
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          Сохраняйте шаблоны из каталога — они появятся здесь
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {templates.map((tpl) => (
        <TemplateCard
          description={tpl.description}
          id={tpl.id}
          key={tpl.id}
          price={tpl.price}
          saved
          title={tpl.title}
        />
      ))}
    </div>
  );
}
