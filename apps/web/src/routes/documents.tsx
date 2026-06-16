import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { ChevronDown, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DocumentCard } from "@/components/document-card";
import { PaginationControls } from "@/components/pagination-controls";
import {
  type SearchSuggestion,
  SearchWithSuggestions,
} from "@/components/search-with-suggestions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { requireAuth } from "@/lib/auth-guard";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/documents")({
  component: RouteComponent,
  beforeLoad: async () => {
    const { session, organizations } = await requireAuth();
    return { session, organizations };
  },
});

const FILTER_DROPDOWNS = [
  "documents.filters.counterparty",
  "documents.filters.amount",
  "documents.filters.status",
  "documents.filters.responsible",
];

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

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) {
      return documents;
    }
    return fuzzySearch(searchQuery, documents, (doc) => [
      doc.title,
      doc.templateTitle,
      doc.authorName,
    ]).map((result) => result.item);
  }, [searchQuery, documents]);

  // Client-side pagination over the filtered list.
  const [page, setPage] = useState(1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset to first page when the search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);
  const pageCount = Math.max(
    1,
    Math.ceil(filteredDocuments.length / PAGE_SIZE)
  );
  const pagedDocuments = filteredDocuments.slice(
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

        {/* Filters + sort */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_DROPDOWNS.map((labelKey) => (
              <DropdownMenu key={labelKey}>
                <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d4d4d4] px-2.5 text-foreground text-sm outline-none hover:border-foreground/30">
                  {t(labelKey)}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <div className="px-2 py-1.5 text-muted-foreground text-xs">
                    {t("common.soon")}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
            <button
              className="px-2 text-muted-foreground text-xs hover:text-foreground"
              onClick={() => setSearchQuery("")}
              type="button"
            >
              {t("common.reset")}
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-full border border-[#e5e5e5] py-2 pr-2 pl-3 text-foreground text-sm outline-none hover:border-foreground/30">
              {t("common.sort")}
              <ChevronDown className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div className="px-2 py-1.5 text-muted-foreground text-xs">
                {t("common.soon")}
              </div>
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
