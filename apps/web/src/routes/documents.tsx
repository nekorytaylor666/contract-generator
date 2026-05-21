import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, FileText, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { DocumentCard } from "@/components/document-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { requireAuth } from "@/lib/auth-guard";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/documents")({
  component: RouteComponent,
  beforeLoad: async () => {
    const { session, organizations } = await requireAuth();
    return { session, organizations };
  },
});

const FILTER_DROPDOWNS = [
  "Контрагент",
  "Сумма договора",
  "Статус договора",
  "Ответственный",
];

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
  const trpc = useTRPC();
  const { data: documents = [], isLoading } = useQuery({
    ...trpc.documents.list.queryOptions(),
    refetchOnMount: "always",
  });
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return documents;
    }
    return documents.filter((doc) => {
      return (
        doc.title.toLowerCase().includes(query) ||
        (doc.templateTitle?.toLowerCase().includes(query) ?? false) ||
        (doc.authorName?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [searchQuery, documents]);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex flex-col gap-4 p-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-12 w-full rounded-full border border-[#e5e5e5] bg-background pr-4 pl-12 text-base outline-none placeholder:text-muted-foreground focus:border-foreground/30"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Введите название договора — найдём ваш документ"
            value={searchQuery}
          />
        </div>

        {/* Filters + sort */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_DROPDOWNS.map((label) => (
              <DropdownMenu key={label}>
                <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d4d4d4] px-2.5 text-foreground text-sm outline-none hover:border-foreground/30">
                  {label}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <div className="px-2 py-1.5 text-muted-foreground text-xs">
                    Скоро
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
            <button
              className="px-2 text-muted-foreground text-xs hover:text-foreground"
              onClick={() => setSearchQuery("")}
              type="button"
            >
              Сбросить
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-full border border-[#e5e5e5] py-2 pr-2 pl-3 text-foreground text-sm outline-none hover:border-foreground/30">
              Сортировать
              <ChevronDown className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div className="px-2 py-1.5 text-muted-foreground text-xs">
                Скоро
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Grid */}
        {renderGrid({
          documents: filteredDocuments,
          hasDocuments: documents.length > 0,
          isLoading,
        })}
      </div>
    </div>
  );
}

function renderGrid({
  documents,
  hasDocuments,
  isLoading,
}: {
  documents: DocumentListItem[];
  hasDocuments: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Загрузка документов...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileText className="mb-3 size-12 text-muted-foreground/30" />
        <p className="font-medium text-foreground text-sm">
          {hasDocuments ? "Документы не найдены" : "Нет сохраненных документов"}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          {hasDocuments
            ? "Попробуйте изменить поисковый запрос"
            : "Создайте документ из шаблона, чтобы он появился здесь"}
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
