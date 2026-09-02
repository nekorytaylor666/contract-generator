import {
  CATEGORY_LABEL_BY_SLUG,
  expandCategorySelection,
  mostSpecificCategory,
} from "@contract-builder/api/constants/template-options";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bookmark, Calendar, Check, ChevronDown, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PaginationControls } from "@/components/pagination-controls";
import {
  type SearchSuggestion,
  SearchWithSuggestions,
} from "@/components/search-with-suggestions";
import { PublicFooter, PublicNavbar } from "@/components/site-chrome";
import { formatUpdated } from "@/components/template-info-dialog";
import { CategoryFilter } from "@/components/templates/category-filter";
import { DocumentTypeFilter } from "@/components/templates/document-type-filter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { useTRPC } from "@/utils/trpc";

// Публичная «Библиотека» (макет «/Library»): тот же каталог, что и в
// приложении, но без auth-функций (закладки, покупки). Карточка ведёт
// авторизованного на шаблон, гостя — на регистрацию.

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

interface LibraryTemplate {
  id: string;
  title: string;
  description: string | null;
  price?: number;
  categories?: string[] | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  purchaseCount?: number;
}

const time = (d?: Date | string) => (d ? new Date(d).getTime() : 0);

function sortTemplates(list: LibraryTemplate[], sort: SortKey) {
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

// Ярлыки категорий приходят из общих констант API и пока только на русском.
function categoryLabel(
  categories: string[] | null | undefined
): string | undefined {
  const slug = mostSpecificCategory(categories);
  return slug ? CATEGORY_LABEL_BY_SLUG[slug] : undefined;
}

function formatPrice(tenge: number): string {
  return `${tenge.toLocaleString("ru-RU")} ₸`;
}

// Облегчённая карточка каталога без закладок и меню действий: вся карточка —
// одна ссылка (авторизованному — шаблон, гостю — регистрация).
function LibraryCard({
  tpl,
  authed,
}: {
  tpl: LibraryTemplate;
  authed: boolean;
}) {
  const { t } = useTranslation();
  const tag = categoryLabel(tpl.categories);
  const isPaid = (tpl.price ?? 0) > 0;
  const cardClassName =
    "group flex h-full min-h-[242px] flex-col justify-between rounded-2xl border border-[#ececec] p-5 transition-colors hover:border-foreground/30";
  const body = (
    <>
      <div className="flex w-full flex-col gap-4">
        <div className="flex h-6 items-center justify-between gap-2">
          {tpl.updatedAt ? (
            <span className="flex shrink-0 items-center gap-1 rounded-lg border border-[#e5e5e5] px-2 py-1 font-medium text-[12px] text-foreground leading-4">
              <Calendar className="size-3" />
              {formatUpdated(tpl.updatedAt)}
            </span>
          ) : (
            <span />
          )}
          <Bookmark aria-hidden className="size-4 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="line-clamp-2 font-semibold text-[16px] text-black leading-5">
            {tpl.title}
          </h3>
          {tpl.description && (
            <p className="line-clamp-3 font-medium text-[14px] text-muted-foreground leading-[18px]">
              {tpl.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 pt-4">
        {tag ? (
          <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-[#f5f5f5] px-2.5 py-1.5 font-medium text-[#171717] text-[12px] leading-4">
            <FileText className="size-3 shrink-0" />
            <span className="truncate">{tag}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="whitespace-nowrap font-medium text-[14px] text-foreground leading-[18px]">
          {isPaid ? formatPrice(tpl.price ?? 0) : t("templates.free")}
        </span>
      </div>
    </>
  );
  if (authed) {
    return (
      <Link
        className={cardClassName}
        params={{ templateId: tpl.id }}
        to="/templates/$templateId"
      >
        {body}
      </Link>
    );
  }
  return (
    <Link className={cardClassName} to="/register">
      {body}
    </Link>
  );
}

export function LibraryPage() {
  const { t, i18n } = useTranslation();
  const { data: session } = authClient.useSession();
  const trpc = useTRPC();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT);

  // Серверный фильтр: выбор категорий (любого уровня) раскрывается до всех
  // потомков, чтобы overlap-совпадение ловило глубже помеченные шаблоны.
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

  const { data: templates = [], isLoading } = useQuery(
    trpc.templates.list.queryOptions(listInput)
  );

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) {
      return templates;
    }
    return fuzzySearch(searchQuery, templates, (item) => item.title).map(
      (result) => result.item
    );
  }, [searchQuery, templates]);

  const sortedTemplates = useMemo(
    () => sortTemplates(filteredTemplates, sortKey),
    [filteredTemplates, sortKey]
  );

  const [page, setPage] = useState(1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: сбрасываем на первую страницу при смене фильтров/поиска/сортировки
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategories, selectedDocTypes, sortKey]);
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

  const hasFilters =
    searchQuery.length > 0 ||
    selectedCategories.length > 0 ||
    selectedDocTypes.length > 0;

  return (
    <div className="min-h-svh bg-white font-landing">
      <PublicNavbar />
      <main className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 pt-6 pb-16 sm:px-6">
        <h1 className="pb-4 font-semibold text-[40px] text-black leading-[48px] sm:text-[48px] sm:leading-[56px]">
          {t("library.title")}
        </h1>

        <SearchWithSuggestions
          ariaLabel={t("templates.searchPlaceholder")}
          onSelectSuggestion={(suggestion) => setSearchQuery(suggestion.label)}
          onValueChange={setSearchQuery}
          placeholder={t("templates.searchPlaceholder")}
          suggestions={searchSuggestions}
          value={searchQuery}
        />

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
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <button
                className="text-muted-foreground text-xs hover:text-foreground"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategories([]);
                  setSelectedDocTypes([]);
                }}
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
                    onSelect={() => setSortKey(key)}
                  >
                    <span>{t(SORT_LABELS[key])}</span>
                    {sortKey === key && <Check className="size-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {renderGrid({
          isLoading,
          templates: pagedTemplates,
          authed: Boolean(session),
          loadingText: t("templates.loading"),
          notFoundText: t("templates.notFound"),
          notFoundHint: t("templates.notFoundHint"),
        })}

        <PaginationControls
          onPageChange={setPage}
          page={page}
          pageCount={pageCount}
        />
      </main>
      <PublicFooter />
    </div>
  );
}

function renderGrid({
  isLoading,
  templates,
  authed,
  loadingText,
  notFoundText,
  notFoundHint,
}: {
  isLoading: boolean;
  templates: LibraryTemplate[];
  authed: boolean;
  loadingText: string;
  notFoundText: string;
  notFoundHint: string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        {loadingText}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="font-medium text-foreground text-sm">{notFoundText}</p>
        <p className="mt-1 text-muted-foreground text-xs">{notFoundHint}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {templates.map((template) => (
        <LibraryCard authed={authed} key={template.id} tpl={template} />
      ))}
    </div>
  );
}
