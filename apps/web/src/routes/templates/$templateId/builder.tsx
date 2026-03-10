import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
  type DocumentStyle,
  DocumentStyleSettings,
} from "@/components/template-builder/document-style-settings";
import { LogoUpload } from "@/components/template-builder/logo-upload";
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
  const [svgPages, setSvgPages] = useState<string[] | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [documentStyle, setDocumentStyle] = useState<DocumentStyle>({
    font: "New Computer Modern",
    preset: "default",
  });
  const latestValuesRef = useRef<Record<string, unknown> | null>(null);

  const {
    data: template,
    isLoading,
    error,
  } = useQuery(trpc.templates.getById.queryOptions({ id: templateId }));

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewMutation = useMutation(
    trpc.templates.preview.mutationOptions({
      onSuccess: (data) => {
        setSvgPages(data.pages);
      },
    })
  );

  const compileMutation = useMutation(
    trpc.templates.compile.mutationOptions({
      onSuccess: (data) => {
        const link = document.createElement("a");
        link.href = data.pdfDataUrl;
        link.download = data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
    })
  );

  const getChangedVariables = useCallback(
    (values: Record<string, unknown>): string[] => {
      const prev = latestValuesRef.current;
      if (!prev) {
        return [];
      }
      const changed: string[] = [];
      for (const key of Object.keys(values)) {
        if (String(values[key]) !== String(prev[key])) {
          changed.push(key);
        }
      }
      return changed;
    },
    []
  );

  const logoRef = useRef<string | null>(null);
  logoRef.current = logo;
  const styleRef = useRef<DocumentStyle>(documentStyle);
  styleRef.current = documentStyle;

  const previewWithValues = useCallback(
    (
      values: Record<string, unknown>,
      options?: {
        changedVariables?: string[];
        logoOverride?: string | null;
        styleOverride?: DocumentStyle;
      }
    ) => {
      const currentLogo =
        options?.logoOverride !== undefined
          ? options.logoOverride
          : logoRef.current;
      const currentStyle = options?.styleOverride ?? styleRef.current;
      previewMutation.mutate({
        templateId,
        variables: values,
        changedVariables: options?.changedVariables,
        logo: currentLogo ?? undefined,
        style: {
          font: currentStyle.font,
          preset: currentStyle.preset,
        },
      });
      latestValuesRef.current = values;
    },
    [templateId, previewMutation.mutate]
  );

  const handleValuesChange = useCallback(
    (values: Record<string, unknown>) => {
      const changed = getChangedVariables(values);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        previewWithValues(values, { changedVariables: changed });
      }, 500);
    },
    [previewWithValues, getChangedVariables]
  );

  const handleFormSubmit = (values: Record<string, unknown>) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    previewWithValues(values);
  };

  const handleDownload = useCallback(() => {
    if (!latestValuesRef.current) {
      return;
    }
    compileMutation.mutate({
      templateId,
      variables: latestValuesRef.current,
      logo: logo ?? undefined,
      style: {
        font: documentStyle.font,
        preset: documentStyle.preset,
      },
    });
  }, [templateId, compileMutation.mutate, logo, documentStyle]);

  const handleLogoChange = useCallback(
    (newLogo: string | null) => {
      setLogo(newLogo);
      previewWithValues(latestValuesRef.current ?? {}, {
        logoOverride: newLogo,
      });
    },
    [previewWithValues]
  );

  const handleStyleChange = useCallback(
    (newStyle: DocumentStyle) => {
      setDocumentStyle(newStyle);
      previewWithValues(latestValuesRef.current ?? {}, {
        styleOverride: newStyle,
      });
    },
    [previewWithValues]
  );

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

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-border border-b bg-background px-4 py-2">
        <DocumentStyleSettings
          onStyleChange={handleStyleChange}
          style={documentStyle}
        />
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Preview Section */}
        <div className="flex-1 overflow-auto bg-muted/30 p-4">
          <div className="mx-auto h-full max-w-3xl">
            <PdfPreview
              isDownloading={compileMutation.isPending}
              isLoading={previewMutation.isPending}
              onDownload={handleDownload}
              svgPages={svgPages}
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

          <LogoUpload logo={logo} onLogoChange={handleLogoChange} />

          <TemplateForm
            isSubmitting={compileMutation.isPending}
            onSubmit={handleFormSubmit}
            onValuesChange={handleValuesChange}
            variables={variables}
          />
        </div>
      </div>
    </div>
  );
}
