import { createFileRoute } from "@tanstack/react-router";
import { Building2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { requireAuth } from "@/lib/auth-guard";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  beforeLoad: async () => {
    const { session } = await requireAuth();
    return { session };
  },
});

function SettingsPage() {
  const { data: organizations } = authClient.useListOrganizations();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingId) {
      return;
    }
    setIsDeleting(true);
    try {
      await authClient.organization.delete({ organizationId: deletingId });
      toast.success("Организация удалена");
      setDeletingId(null);
      window.location.href = "/";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="border-b px-6 py-4">
        <h1 className="font-semibold text-lg">Настройки</h1>
      </div>

      <div className="flex flex-col gap-6 p-6">
        <section>
          <h2 className="mb-3 font-medium text-sm">Организации</h2>
          <div className="flex flex-col gap-2">
            {organizations?.length === 0 && (
              <p className="text-muted-foreground text-sm">
                У вас нет организаций
              </p>
            )}
            {organizations?.map((org) => (
              <div
                className="flex items-center justify-between rounded-lg border bg-card p-4"
                key={org.id}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md border">
                    <Building2 className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{org.name}</span>
                      {activeOrg?.id === org.id && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
                          активная
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">{org.slug}</p>
                  </div>
                </div>
                <Button
                  onClick={() => setDeletingId(org.id)}
                  size="sm"
                  variant="outline"
                >
                  <Trash2 className="mr-1.5 size-3.5 text-destructive" />
                  Удалить
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <AlertDialog
        onOpenChange={(open) => !open && setDeletingId(null)}
        open={deletingId !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить организацию?</AlertDialogTitle>
            <AlertDialogDescription>
              Действие необратимо. Все участники, документы и приглашения этой
              организации будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
