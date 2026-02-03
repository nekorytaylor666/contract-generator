import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUser } from "@/functions/get-user";
import { getUserOrganizations } from "@/functions/get-user-organizations";
import { useTRPC } from "@/utils/trpc";
import type { TemplateVariable } from "../";

export const Route = createFileRoute("/templates/$templateId/")({
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
  const { templateId } = Route.useParams();
  const trpc = useTRPC();

  const {
    data: template,
    isLoading,
    error,
  } = useQuery(trpc.templates.getById.queryOptions({ id: templateId }));

  const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading template...</div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <FileText className="size-12 text-muted-foreground/40" />
        <p className="mt-3 font-medium text-foreground text-sm">
          Template not found
        </p>
        <Link
          className="mt-2 text-primary text-sm hover:underline"
          to="/templates"
        >
          Back to Templates
        </Link>
      </div>
    );
  }

  const variables = template.variables as TemplateVariable[];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border border-b bg-background p-4">
        <Link
          className="mb-3 inline-flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
          to="/templates"
        >
          <ArrowLeft className="size-3.5" />
          Back to Templates
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-semibold text-base text-foreground">
              {template.title}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground text-xs">
              {template.description}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {variables.length} fields to fill
              </span>
            </div>
          </div>
          <Badge className="shrink-0 text-sm" variant="secondary">
            {formatPrice(template.price)} SAR
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Preview Section */}
        <div className="flex-1 overflow-auto bg-muted/30 p-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-3 font-medium text-foreground text-sm">
              Contract Preview
            </h2>
            <div className="flex aspect-[8.5/11] items-center justify-center rounded-lg border border-border border-dashed bg-background">
              <div className="text-center">
                <FileText className="mx-auto size-16 text-muted-foreground/30" />
                <p className="mt-3 text-muted-foreground text-sm">
                  Contract Preview
                </p>
                <p className="mt-0.5 text-muted-foreground/60 text-xs">
                  Typst template will be rendered here
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Fields Sidebar */}
        <div className="w-80 shrink-0 overflow-auto border-border border-l bg-background p-4">
          <h2 className="mb-2 font-medium text-foreground text-sm">
            Required Information
          </h2>
          <p className="mb-4 text-muted-foreground text-xs">
            These fields will need to be filled when using this template.
          </p>

          <div className="space-y-2">
            {variables.map((field) => (
              <Card key={field.name} size="sm">
                <CardHeader className="pb-1">
                  <CardTitle className="flex items-center gap-1.5">
                    {field.label}
                    {field.required && (
                      <span className="text-destructive">*</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{field.type}</Badge>
                    {field.options && (
                      <span className="text-muted-foreground text-xs">
                        {field.options.length} options
                      </span>
                    )}
                    {field.defaultValue !== undefined && (
                      <span className="text-muted-foreground text-xs">
                        Default: {String(field.defaultValue)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button className="mt-4 w-full" size="lg">
            Use This Template
          </Button>
        </div>
      </div>
    </div>
  );
}
