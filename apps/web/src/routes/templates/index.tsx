import {
  CATEGORY_LABEL_BY_SLUG,
  expandCategorySelection,
  isDocumentType,
  isKnownCategorySlug,
  mostSpecificCategory,
} from "@contract-builder/api/constants/template-options";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { Bookmark, Check, ChevronDown, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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
import { requireAuth } from "@/lib/auth-guard";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { useTRPC } from "@/utils/trpc";

export interface TemplateVariable {
  name: string;
  type: "text" | "textarea" | "date" | "number" | "boolean" | "select";
  label: string;
  /** Optional helper text shown under the field label (from `// @hint …`). */
  hint?: string;
  required: boolean;
  defaultValue?: string | number | boolean;
  options?: string[];
  /** Per-option description shown under the title in radio cards (from
   * `// option :: описание | …`). Keyed by option value. */
  optionDescriptions?: Record<string, string>;
  dependsOn?: {
    field: string;
    value?: string | string[] | boolean;
    operator?: "eq" | "neq" | "in";
  };
  wordForms?: [string, string, string];
}

const PAGE_SIZE = 12;

const SORT_KEYS = [
  "new",
  "popular",
  "updated",
  "priceAsc",
  "priceDesc",
] as const;
type SortKey = (typeof SORT_KEYS)[number];
const DEFAULT_SORT: SortKey = "new";

const SORT_LABELS: Record<SortKey, string> = {
  new: "templates.sortNew",
  popular: "templates.sortPopular",
  updated: "templates.sortUpdated",
  priceAsc: "templates.sortPriceAsc",
  priceDesc: "templates.sortPriceDesc",
};

function isSortKey(value: unknown): value is SortKey {
  return (
    typeof value === "string" &&
    (SORT_KEYS as readonly string[]).includes(value)
  );
}

interface SortableTemplate {
  price?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  purchaseCount?: number;
}

const time = (d?: Date | string) => (d ? new Date(d).getTime() : 0);

function sortTemplates<T extends SortableTemplate>(
  list: T[],
  sort: SortKey
): T[] {
  const arr = [...list];
  switch (sort) {
    case "popular":
      return arr.sort(
        (a, b) => (b.purchaseCount ?? 0) - (a.purchaseCount ?? 0)
      );
    case "updated":
      return arr.sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
    case "priceAsc":
      return arr.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    case "priceDesc":
      return arr.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    default:
      return arr.sort((a, b) => time(b.createdAt) - time(a.createdAt));
  }
}

// Human label for a template's category, taken from the deepest known slug.
function categoryLabel(
  categories: string[] | null | undefined
): string | undefined {
  const slug = mostSpecificCategory(categories);
  return slug ? CATEGORY_LABEL_BY_SLUG[slug] : undefined;
}

function toStringArray(
  value: unknown,
  guard: (v: unknown) => boolean
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => guard(item));
}

interface TemplatesSearch {
  q?: string;
  categories?: string[];
  docTypes?: string[];
  saved?: boolean;
  sort?: SortKey;
}

export const Route = createFileRoute("/templates/")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): TemplatesSearch => {
    const categories = toStringArray(search.categories, isKnownCategorySlug);
    const docTypes = toStringArray(search.docTypes, isDocumentType);
    return {
      q: search.q ? String(search.q) : undefined,
      categories: categories.length > 0 ? categories : undefined,
      docTypes: docTypes.length > 0 ? docTypes : undefined,
      saved: search.saved ? true : undefined,
      sort: isSortKey(search.sort) ? search.sort : undefined,
    };
  },
  beforeLoad: async () => {
    const { session, organizations } = await requireAuth();
    return { session, organizations };
  },
});

function RouteComponent() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { q, categories, docTypes, saved, sort } = Route.useSearch();
  const searchQuery = q ?? "";
  const savedOnly = saved ?? false;
  const sortKey = sort ?? DEFAULT_SORT;
  const selectedCategories = useMemo(() => categories ?? [], [categories]);
  const selectedDocTypes = useMemo(() => docTypes ?? [], [docTypes]);
  const hasFilters =
    searchQuery.length > 0 ||
    selectedCategories.length > 0 ||
    selectedDocTypes.length > 0 ||
    savedOnly;

  const updateSearch = (next: Partial<TemplatesSearch>) => {
    navigate({
      to: "/templates",
      search: (prev) => ({ ...prev, ...next }),
      replace: true,
    });
  };

  const handleSearchChange = (value: string) =>
    updateSearch({ q: value || undefined });

  const handleCategoriesChange = (next: string[]) => {
    // Dropping a category may make some selected doc types irrelevant; the
    // DocumentTypeFilter re-gates on next render, so just clear when empty.
    updateSearch({
      categories: next.length > 0 ? next : undefined,
      docTypes: next.length > 0 ? selectedDocTypes : undefined,
    });
  };

  const handleDocTypesChange = (next: string[]) =>
    updateSearch({ docTypes: next.length > 0 ? next : undefined });

  const trpc = useTRPC();

  // Build the server filter: expand the category selection (any level) down to
  // every descendant slug so an array overlap matches deeper-tagged templates.
  const listInput = useMemo(() => {
    const input: {
      locale: string;
      categories?: string[];
      documentTypes?: string[];
    } = { locale: i18n.language };
    if (selectedCategories.length > 0) {
      input.categories = expandCategorySelection(selectedCategories);
    }
    if (selectedDocTypes.length > 0) {
      input.documentTypes = selectedDocTypes;
    }
    return input;
  }, [selectedCategories, selectedDocTypes, i18n.language]);

  const { data: templates = [], isLoading } = useQuery({
    ...trpc.templates.list.queryOptions(listInput),
    // Catalogue revalidates on every visit so fresh admin edits (titles,
    // prices, photos via ?v) show up without a hard reload. Focus refetch is
    // forced too: "admin edits in one window, checks as client in another"
    // must not be gated by the global staleTime.
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });

  const { data: bookmarkIds = [] } = useQuery(
    trpc.templates.myBookmarks.queryOptions()
  );
  const bookmarkSet = useMemo(() => new Set(bookmarkIds), [bookmarkIds]);

  const filteredTemplates = useMemo(() => {
    const base = savedOnly
      ? templates.filter((item) => bookmarkSet.has(item.id))
      : templates;
    if (!searchQuery.trim()) {
      return base;
    }
    return fuzzySearch(searchQuery, base, (item) => item.title).map(
      (result) => result.item
    );
  }, [searchQuery, templates, savedOnly, bookmarkSet]);

  const sortedTemplates = useMemo(
    () => sortTemplates(filteredTemplates, sortKey),
    [filteredTemplates, sortKey]
  );

  // Client-side pagination over the sorted list (keeps search/filters intact).
  const [page, setPage] = useState(1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset to first page when the filters/search/sort change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategories, selectedDocTypes, savedOnly, sortKey]);
  const pageCount = Math.max(1, Math.ceil(sortedTemplates.length / PAGE_SIZE));
  const pagedTemplates = sortedTemplates.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const searchSuggestions = useMemo<SearchSuggestion[]>(
    () =>
      templates.map((item) => ({
        id: item.id,
        label: item.title,
        sublabel: categoryLabel(item.categories),
      })),
    [templates]
  );

  const { data: purchasedIds = [] } = useQuery(
    trpc.payments.myPurchasedTemplateIds.queryOptions()
  );
  const purchasedSet = useMemo(() => new Set(purchasedIds), [purchasedIds]);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {/* Page heading */}
        <h1 className="font-semibold text-2xl text-foreground leading-7">
          {t("templates.title")}
        </h1>

        {/* Search */}
        <SearchWithSuggestions
          ariaLabel={t("templates.searchPlaceholder")}
          onSelectSuggestion={(suggestion) =>
            handleSearchChange(suggestion.label)
          }
          onValueChange={handleSearchChange}
          placeholder={t("templates.searchPlaceholder")}
          suggestions={searchSuggestions}
          value={searchQuery}
        />

        {/* Filters + saved + sort */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryFilter
              onChange={handleCategoriesChange}
              selected={selectedCategories}
            />
            <DocumentTypeFilter
              onChange={handleDocTypesChange}
              selected={selectedDocTypes}
            />
            <button
              className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-foreground text-sm outline-none ${
                savedOnly
                  ? "border-foreground/40 bg-muted"
                  : "border-[#ececec] hover:border-foreground/30"
              }`}
              onClick={() =>
                updateSearch({ saved: savedOnly ? undefined : true })
              }
              type="button"
            >
              <Bookmark
                className={savedOnly ? "size-4 fill-current" : "size-4"}
              />
              {t("templates.saved")}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <button
                className="text-muted-foreground text-xs hover:text-foreground"
                onClick={() =>
                  navigate({ to: "/templates", search: {}, replace: true })
                }
                type="button"
              >
                {t("common.reset")}
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#e5e5e5] py-2 pr-2 pl-3 text-foreground text-sm outline-none hover:border-foreground/30">
                {t("common.sort")}
                <ChevronDown className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                {SORT_KEYS.map((key) => (
                  <DropdownMenuItem
                    className="justify-between"
                    key={key}
                    onSelect={() =>
                      updateSearch({
                        sort: key === DEFAULT_SORT ? undefined : key,
                      })
                    }
                  >
                    <span>{t(SORT_LABELS[key])}</span>
                    {sortKey === key && <Check className="size-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Grid */}
        {renderGrid({
          isLoading,
          templates: pagedTemplates,
          purchasedSet,
          bookmarkSet,
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
  isLoading,
  templates,
  purchasedSet,
  bookmarkSet,
  t,
}: {
  isLoading: boolean;
  templates: Array<{
    id: string;
    title: string;
    description?: string | null;
    price?: number;
    categories?: string[] | null;
  }>;
  purchasedSet: Set<string>;
  bookmarkSet: Set<string>;
  t: TFunction;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        {t("templates.loading")}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="font-medium text-foreground text-sm">
          {t("templates.notFound")}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          {t("templates.notFoundHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {templates.map((template) => (
        <TemplateCard
          categoryIcon={FileText}
          categoryLabel={categoryLabel(template.categories)}
          description={template.description}
          id={template.id}
          key={template.id}
          price={template.price}
          purchased={purchasedSet.has(template.id)}
          saved={bookmarkSet.has(template.id)}
          title={template.title}
        />
      ))}
    </div>
  );
}
