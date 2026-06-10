import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  type TemplateCategory,
} from "@contract-builder/api/constants/template-options";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import {
  Bookmark,
  Briefcase,
  Check,
  ChevronDown,
  Code2,
  DollarSign,
  Building2 as House,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  type SearchSuggestion,
  SearchWithSuggestions,
} from "@/components/search-with-suggestions";
import { TemplateCard } from "@/components/template-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { requireAuth } from "@/lib/auth-guard";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

export interface TemplateVariable {
  name: string;
  type: "text" | "textarea" | "date" | "number" | "boolean" | "select";
  label: string;
  required: boolean;
  defaultValue?: string | number | boolean;
  options?: string[];
  dependsOn?: {
    field: string;
    value?: string | string[];
    operator?: "eq" | "neq" | "in";
  };
  wordForms?: [string, string, string];
}

// Filters without wired options yet — placeholders until the user provides
// their dictionaries (industry, contract type, payment terms, validity,
// participants).
const PLACEHOLDER_FILTERS = [
  "templates.filters.industry",
  "templates.filters.contractType",
  "templates.filters.paymentTerms",
  "templates.filters.validity",
  "templates.filters.participants",
];

const CARD_CATEGORIES: { label: string; icon: LucideIcon }[] = [
  { label: "Недвижимость", icon: House },
  { label: "Разработка", icon: Code2 },
  { label: "Строительство", icon: Briefcase },
  { label: "Финансы", icon: DollarSign },
];

function isTemplateCategory(value: unknown): value is TemplateCategory {
  return (
    typeof value === "string" &&
    (CATEGORY_VALUES as readonly string[]).includes(value)
  );
}

// Human-readable label for a suggestion, taken from the template's first known
// category. Returns undefined when the template has no recognised category.
function categoryLabel(
  categories: string[] | null | undefined
): string | undefined {
  const match = categories?.find(isTemplateCategory);
  return match ? CATEGORY_LABELS[match] : undefined;
}

export const Route = createFileRoute("/templates/")({
  component: RouteComponent,
  validateSearch: (
    search: Record<string, unknown>
  ): { q?: string; category?: TemplateCategory } => {
    return {
      q: search.q ? String(search.q) : undefined,
      category: isTemplateCategory(search.category)
        ? search.category
        : undefined,
    };
  },
  beforeLoad: async () => {
    const { session, organizations } = await requireAuth();
    return { session, organizations };
  },
});

function RouteComponent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { q, category } = Route.useSearch();
  const searchQuery = q ?? "";

  const handleSearchChange = (value: string) => {
    navigate({
      to: "/templates",
      search: { q: value || undefined, category },
      replace: true,
    });
  };

  const handleCategoryChange = (next: TemplateCategory | undefined) => {
    navigate({
      to: "/templates",
      search: { q: searchQuery || undefined, category: next },
      replace: true,
    });
  };

  const trpc = useTRPC();

  // Fetch the category-filtered list once, then fuzzy-match on the client so
  // typos still surface results (server ilike needs an exact substring).
  const { data: templates = [], isLoading } = useQuery(
    trpc.templates.list.queryOptions(category ? { category } : undefined)
  );

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) {
      return templates;
    }
    return fuzzySearch(searchQuery, templates, (t) => t.title).map(
      (result) => result.item
    );
  }, [searchQuery, templates]);

  const searchSuggestions = useMemo<SearchSuggestion[]>(
    () =>
      templates.map((t) => ({
        id: t.id,
        label: t.title,
        sublabel: categoryLabel(t.categories),
      })),
    [templates]
  );

  const queryClient = useQueryClient();
  const { data: purchasedIds = [] } = useQuery(
    trpc.payments.myPurchasedTemplateIds.queryOptions()
  );
  const purchasedSet = useMemo(() => new Set(purchasedIds), [purchasedIds]);
  const [payingId, setPayingId] = useState<string | null>(null);

  const checkoutMutation = useMutation(
    trpc.payments.createTemplateCheckout.mutationOptions({
      onSuccess: (result) => {
        if (result.alreadyPurchased) {
          toast.success(t("templates.alreadyPurchased"));
          queryClient.invalidateQueries({
            queryKey: trpc.payments.myPurchasedTemplateIds.queryKey(),
          });
          setPayingId(null);
          return;
        }
        window.location.href = result.url;
      },
      onError: (error) => {
        toast.error(error.message);
        setPayingId(null);
      },
    })
  );

  const handlePay = (templateId: string) => {
    setPayingId(templateId);
    checkoutMutation.mutate({ templateId });
  };

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex flex-col gap-4 p-6">
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
            {/* Категория — реальный фильтр */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-foreground text-sm outline-none hover:border-foreground/30 data-open:border-foreground/30",
                  category ? "border-foreground/40" : "border-[#ececec]"
                )}
              >
                {category ? CATEGORY_LABELS[category] : t("templates.category")}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[300px]">
                {CATEGORY_VALUES.map((value) => {
                  const selected = category === value;
                  return (
                    <DropdownMenuItem
                      className={cn("justify-between", selected && "bg-muted")}
                      key={value}
                      onSelect={() =>
                        handleCategoryChange(selected ? undefined : value)
                      }
                    >
                      <span>{CATEGORY_LABELS[value]}</span>
                      {selected && <Check className="size-4 text-foreground" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Остальные фильтры — заглушки, пока без бэкенд-словарей */}
            {PLACEHOLDER_FILTERS.map((labelKey) => (
              <DropdownMenu key={labelKey}>
                <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#ececec] px-3 text-foreground text-sm outline-none hover:border-foreground/30 data-open:border-foreground/30">
                  {t(labelKey)}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[300px]">
                  <div className="px-2 py-1.5 text-muted-foreground text-xs">
                    {t("common.soon")}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#e5e5e5] px-3 text-foreground text-sm outline-none hover:border-foreground/30"
              type="button"
            >
              <Bookmark className="size-4" />
              {t("templates.saved")}
            </button>
            {(category || searchQuery) && (
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
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-muted-foreground text-xs">
                  {t("common.soon")}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Grid */}
        {renderGrid({
          isLoading,
          templates: filteredTemplates,
          purchasedSet,
          payingId,
          onPay: handlePay,
          t,
        })}
      </div>
    </div>
  );
}

function renderGrid({
  isLoading,
  templates,
  purchasedSet,
  payingId,
  onPay,
  t,
}: {
  isLoading: boolean;
  templates: Array<{
    id: string;
    title: string;
    description?: string | null;
    createdAt?: Date | string;
    price?: number;
  }>;
  purchasedSet: Set<string>;
  payingId: string | null;
  onPay: (templateId: string) => void;
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
      {templates.map((template, index) => {
        const category = CARD_CATEGORIES[index % CARD_CATEGORIES.length];
        return (
          <TemplateCard
            categoryIcon={category.icon}
            categoryLabel={category.label}
            createdAt={template.createdAt}
            description={template.description}
            id={template.id}
            isPurchasing={payingId === template.id}
            key={template.id}
            onPay={() => onPay(template.id)}
            price={template.price}
            purchased={purchasedSet.has(template.id)}
            title={template.title}
          />
        );
      })}
    </div>
  );
}
