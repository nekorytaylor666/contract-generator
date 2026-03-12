import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { DocumentCard } from "@/components/document-card";
import { getUser } from "@/functions/get-user";
import { getUserOrganizations } from "@/functions/get-user-organizations";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/documents")({
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
  const trpc = useTRPC();
  const { data: documents = [], isLoading } = useQuery(
    trpc.documents.list.queryOptions()
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Загрузка документов...</div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <FileText className="mb-3 size-12 text-muted-foreground/30" />
        <p className="font-medium text-foreground text-sm">
          Нет сохраненных документов
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          Создайте документ из шаблона, чтобы он появился здесь
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
      </div>
    </div>
  );
}
