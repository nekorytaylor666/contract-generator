import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PdfPreview } from "@/components/template-builder/pdf-preview";
import { TemplateForm } from "@/components/template-builder/template-form";
import { Badge } from "@/components/ui/badge";
import { getUser } from "@/functions/get-user";
import { getUserOrganizations } from "@/functions/get-user-organizations";
import type { TemplateVariable } from "@/routes/templates";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/templates/$templateId/builder")({
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
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);

  const {
    data: template,
    isLoading,
    error,
  } = useQuery(trpc.templates.getById.queryOptions({ id: templateId }));

  const compileMutation = useMutation(
    trpc.templates.compile.mutationOptions({
      onSuccess: (data) => {
        setPdfDataUrl(data.pdfDataUrl);
        toast.success("PDF generated successfully");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate PDF");
      },
    })
  );

  const handleFormSubmit = (values: Record<string, unknown>) => {
    compileMutation.mutate({
      templateId,
      variables: values,
    });
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
        <p className="font-medium text-foreground text-sm">
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
          params={{ templateId }}
          to="/templates/$templateId"
        >
          <ArrowLeft className="size-3.5" />
          Back to Template
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-semibold text-base text-foreground">
              {template.title}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground text-xs">
              Fill in the details below to generate your document
            </p>
          </div>
          <Badge className="shrink-0 text-sm" variant="secondary">
            {(template.price / 100).toFixed(2)} SAR
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Preview Section */}
        <div className="flex-1 overflow-auto bg-muted/30 p-4">
          <div className="mx-auto h-full max-w-3xl">
            <PdfPreview
              isLoading={compileMutation.isPending}
              pdfDataUrl={pdfDataUrl}
              templateTitle={template.title}
            />
          </div>
        </div>

        {/* Form Sidebar */}
        <div className="w-80 shrink-0 overflow-auto border-border border-l bg-background p-4">
          <h2 className="mb-2 font-medium text-foreground text-sm">
            Document Details
          </h2>
          <p className="mb-4 text-muted-foreground text-xs">
            Fill in the required information to generate your document.
          </p>

          <TemplateForm
            isSubmitting={compileMutation.isPending}
            onSubmit={handleFormSubmit}
            variables={variables}
          />
        </div>
      </div>
    </div>
  );
}
