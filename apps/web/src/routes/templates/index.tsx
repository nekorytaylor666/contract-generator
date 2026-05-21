import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  type TemplateCategory,
} from "@contract-builder/api/constants/template-options";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bookmark,
  Briefcase,
  Check,
  ChevronDown,
  Code2,
  DollarSign,
  Building2 as House,
  type LucideIcon,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";

import { TemplateCard } from "@/components/template-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { requireAuth } from "@/lib/auth-guard";
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
  "Отрасль",
  "Тип договора",
  "Условия оплаты",
  "Срок действия",
  "Участники",
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
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  // Debounce search input -> server query.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const queryInput =
    debouncedQuery || category
      ? { q: debouncedQuery || undefined, category }
      : undefined;

  const { data: templates = [], isLoading } = useQuery(
    trpc.templates.list.queryOptions(queryInput)
  );

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex flex-col gap-4 p-6">
        {/* Page heading */}
        <h1 className="font-semibold text-2xl text-foreground leading-7">
          Шаблоны
        </h1>

        {/* Search */}
        <div className="relative">
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-12 w-full rounded-full border border-[#e5e5e5] bg-background pr-4 pl-11 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground/30"
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Название договора или категория"
            value={searchQuery}
          />
        </div>

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
                {category ? CATEGORY_LABELS[category] : "Категория"}
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
            {PLACEHOLDER_FILTERS.map((label) => (
              <DropdownMenu key={label}>
                <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#ececec] px-3 text-foreground text-sm outline-none hover:border-foreground/30 data-open:border-foreground/30">
                  {label}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[300px]">
                  <div className="px-2 py-1.5 text-muted-foreground text-xs">
                    Скоро
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
              Сохранённые
            </button>
            {(category || searchQuery) && (
              <button
                className="text-muted-foreground text-xs hover:text-foreground"
                onClick={() =>
                  navigate({ to: "/templates", search: {}, replace: true })
                }
                type="button"
              >
                Сбросить
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#e5e5e5] py-2 pr-2 pl-3 text-foreground text-sm outline-none hover:border-foreground/30">
                Сортировка
                <ChevronDown className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-muted-foreground text-xs">
                  Скоро
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Grid */}
        {renderGrid({ isLoading, templates })}
      </div>
    </div>
  );
}

function renderGrid({
  isLoading,
  templates,
}: {
  isLoading: boolean;
  templates: Array<{
    id: string;
    title: string;
    description?: string | null;
    createdAt?: Date | string;
  }>;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Загрузка шаблонов...
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="font-medium text-foreground text-sm">
          Шаблоны не найдены
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          Попробуйте изменить поисковый запрос
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
            key={template.id}
            title={template.title}
          />
        );
      })}
    </div>
  );
}
