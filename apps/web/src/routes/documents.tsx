import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { Check, ChevronDown, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DocumentCard } from "@/components/document-card";
import { PaginationControls } from "@/components/pagination-controls";
import {
  type SearchSuggestion,
  SearchWithSuggestions,
} from "@/components/search-with-suggestions";
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

interface DocumentListItem {
  id: string;
  title: string;
  templateId: string;
  templateTitle: string | null;
  authorName: string | null;
  currentVersion: number;
  updatedAt: Date | string;
}

function RouteComponent() {
  const { t } = useTranslation();
  const trpc = useTRPC();
  const { data: documents = [], isLoading } = useQuery({
    ...trpc.documents.list.queryOptions(),
    refetchOnMount: "always",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("new");
  const [tab, setTab] = useState<DocTab>("all");

  const visibleDocuments = useMemo(() => {
    let list = documents;
    if (tab === "saved") {
      list = list.filter((doc) => doc.status === "signed");
    } else if (tab === "drafts") {
      list = list.filter((doc) => doc.status === "draft");
    } else if (tab === "completed") {
      list = list.filter((doc) => doc.status === "completed");
    }
    if (selectedCategories.length > 0) {
      const set = new Set(selectedCategories);
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
  }, [documents, tab, selectedCategories, selectedDocTypes, searchQuery, sort]);

  const hasFilters =
    searchQuery.trim().length > 0 ||
    selectedCategories.length > 0 ||
    selectedDocTypes.length > 0;

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategories([]);
    setSelectedDocTypes([]);
  };

  // Client-side pagination over the filtered list.
  const [page, setPage] = useState(1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategories, selectedDocTypes, sort, tab]);
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
  const orgName = activeOrg?.name ?? t("nav.documents");

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

        {/* Total contracts */}
        <div className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:max-w-xs">
          <span className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileText className="size-4" />
            Всего договоров
          </span>
          <span className="font-semibold text-3xl text-foreground leading-none">
            {documents.length}
          </span>
          <span className="text-muted-foreground text-xs">За всё время</span>
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

        {/* Filters + sort — same controls as the templates catalogue */}
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
              <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#ececec] px-3 text-foreground text-sm outline-none hover:border-foreground/30">
                {t("documents.filters.status")}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <div className="px-2 py-1.5 text-muted-foreground text-xs">
                  {t("common.soon")}
                </div>
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
                  className={cn("justify-between", key === sort && "bg-muted")}
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

        {/* Grid */}
        {renderGrid({
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
      </div>
    </div>
  );
}

function renderGrid({
  documents,
  hasDocuments,
  isLoading,
  t,
}: {
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
          authorName={doc.authorName}
          currentVersion={doc.currentVersion}
          id={doc.id}
          key={doc.id}
          templateId={doc.templateId}
          templateTitle={doc.templateTitle}
          title={doc.title}
          updatedAt={doc.updatedAt}
        />
      ))}
    </div>
  );
}
