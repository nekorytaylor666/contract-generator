import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { FileText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const priceRanges = [
  { label: "All Prices", value: "all" },
  { label: "Under 30 SAR", value: "under-30" },
  { label: "30-50 SAR", value: "30-50" },
  { label: "Over 50 SAR", value: "over-50" },
];

export const Route = createFileRoute("/templates/")({
  component: RouteComponent,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriceRange, setSelectedPriceRange] = useState("all");

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

      const priceInSAR = template.price / 100;
      let matchesPrice = true;
      if (selectedPriceRange === "under-30") {
        matchesPrice = priceInSAR < 30;
      } else if (selectedPriceRange === "30-50") {
        matchesPrice = priceInSAR >= 30 && priceInSAR <= 50;
      } else if (selectedPriceRange === "over-50") {
        matchesPrice = priceInSAR > 50;
      }

      return matchesSearch && matchesPrice;
    });
  }, [searchQuery, selectedPriceRange, templates]);

  const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-semibold text-base text-foreground">
          Contract Templates
        </h1>
        <p className="mt-0.5 text-muted-foreground text-xs">
          Browse and select a template to create your contract
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            value={searchQuery}
          />
        </div>

        <Select
          onValueChange={setSelectedPriceRange}
          value={selectedPriceRange}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Price Range" />
          </SelectTrigger>
          <SelectContent>
            {priceRanges.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      <p className="mb-3 text-muted-foreground text-xs">
        {filteredTemplates.length} template
        {filteredTemplates.length !== 1 ? "s" : ""} found
      </p>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredTemplates.map((template) => {
          const variables = template.variables as TemplateVariable[];
          return (
            <Link
              className="block"
              key={template.id}
              params={{ templateId: template.id }}
              to="/templates/$templateId"
            >
              <Card className="h-full cursor-pointer transition-colors hover:bg-accent/50">
                {/* Preview Placeholder */}
                <div className="flex h-28 items-center justify-center rounded-t-lg bg-muted">
                  <FileText className="size-10 text-muted-foreground/40" />
                </div>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-1">
                      {template.title}
                    </CardTitle>
                    <Badge className="shrink-0" variant="secondary">
                      {formatPrice(template.price)} SAR
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-muted-foreground">
                    {template.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {variables.length} fields
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <FileText className="size-12 text-muted-foreground/40" />
          <p className="mt-3 font-medium text-foreground text-sm">
            No templates found
          </p>
          <p className="mt-0.5 text-muted-foreground text-xs">
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
  );
}
