import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Filter, Search } from "lucide-react";
import { useMemo } from "react";
import { useCommandSearch } from "@/components/command-search/command-search-context";
import { TemplateCard } from "@/components/template-card";
import { TemplateCategorySection } from "@/components/template-category-section";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { getUser } from "@/functions/get-user";
import { getUserOrganizations } from "@/functions/get-user-organizations";
import { useTRPC } from "@/utils/trpc";

export interface TemplateVariable {
  name: string;
  type: "text" | "date" | "number" | "boolean" | "select";
  label: string;
  required: boolean;
  defaultValue?: string | number | boolean;
  options?: string[];
}

// Mock categories - will be fetched from backend later
const TEMPLATE_CATEGORIES = [
  { id: "contracts-deals", name: "Договора и сделки" },
  { id: "employment", name: "Трудовые договора" },
  { id: "civil", name: "Гражданские договора" },
] as const;

// Mock category assignments - will come from backend later
function getCategoryForTemplate(templateIndex: number): string {
  const categories = TEMPLATE_CATEGORIES.map((c) => c.id);
  return categories[templateIndex % categories.length];
}

export const Route = createFileRoute("/templates/")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    return {
      q: search.q ? String(search.q) : undefined,
    };
  },
  beforeLoad: async () => {
    const session = await getUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({
        to: "/login",
      });
    }

    const { organizations } = await getUserOrganizations();

    if (organizations.length === 0) {
      throw redirect({
        to: "/onboarding",
      });
    }

    return { organizations };
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const { q } = Route.useSearch();
  const searchQuery = q ?? "";
  const { open: openCommandSearch } = useCommandSearch();

  const handleSearchChange = (value: string) => {
    navigate({
      to: "/templates",
      search: { q: value || undefined },
      replace: true,
    });
  };

  const trpc = useTRPC();
  const { data: templates = [], isLoading } = useQuery(
    trpc.templates.list.queryOptions()
  );

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesSearch =
        template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (template.description
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ??
          false);

      return matchesSearch;
    });
  }, [searchQuery, templates]);

  // Group templates by category
  const groupedTemplates = useMemo(() => {
    const groups: Record<
      string,
      Array<(typeof filteredTemplates)[number] & { categoryId: string }>
    > = {};

    for (const category of TEMPLATE_CATEGORIES) {
      groups[category.id] = [];
    }

    for (const [index, template] of filteredTemplates.entries()) {
      const categoryId = getCategoryForTemplate(index);
      groups[categoryId].push({ ...template, categoryId });
    }

    return groups;
  }, [filteredTemplates]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Загрузка шаблонов...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* Search Bar */}
      <div className="sticky top-0 z-10 bg-background px-6 py-4">
        <InputGroup className="h-10">
          <InputGroupAddon align="inline-start">
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={openCommandSearch}
            placeholder="Поиск шаблонов... (⌘K)"
            readOnly
            value={searchQuery}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              onClick={openCommandSearch}
              size="sm"
              variant="ghost"
            >
              <Filter className="size-3.5" />
              Фильтр
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-8 p-6">
        {TEMPLATE_CATEGORIES.map((category) => {
          const categoryTemplates = groupedTemplates[category.id];
          if (categoryTemplates.length === 0 && searchQuery) {
            return null;
          }

          return (
            <TemplateCategorySection
              key={category.id}
              title={category.name}
              viewAllHref="#"
            >
              {categoryTemplates.length > 0 ? (
                categoryTemplates.map((template) => (
                  <TemplateCard
                    createdAt={template.createdAt}
                    description={template.description}
                    id={template.id}
                    key={template.id}
                    title={template.title}
                  />
                ))
              ) : (
                <div className="col-span-full py-8 text-center text-muted-foreground text-sm">
                  Нет шаблонов в этой категории
                </div>
              )}
            </TemplateCategorySection>
          );
        })}

        {/* Empty State */}
        {filteredTemplates.length === 0 && searchQuery && (
          <div className="flex flex-1 flex-col items-center justify-center py-12">
            <p className="font-medium text-foreground text-sm">
              Шаблоны не найдены
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              Попробуйте изменить поисковый запрос
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
