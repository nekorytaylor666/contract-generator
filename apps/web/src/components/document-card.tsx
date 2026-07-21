import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  CircleDashed,
  MoreHorizontal,
  PenLine,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  DocumentDateChip,
  DocumentStatusBadge,
  documentStatusLabel,
  normalizeDocumentStatus,
  SETTABLE_STATUSES,
} from "@/components/document-status";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTRPC } from "@/utils/trpc";

interface DocumentCardProps {
  id: string;
  title: string;
  templateTitle: string | null;
  templateId: string;
  status: string;
  updatedAt: Date | string;
  /** Смена статуса доступна только на платной подписке. */
  canChangeStatus: boolean;
}

// Финальные статусы: документ уже не редактируют, в меню остаются только
// смена статуса и удаление (как на вкладке «Завершённые» в макете).
const FINAL_STATUSES = new Set(["signed", "expired", "terminated"]);

export function DocumentCard({
  id,
  title,
  templateTitle,
  templateId,
  status,
  updatedAt,
  canChangeStatus,
}: DocumentCardProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const currentStatus = normalizeDocumentStatus(status);
  const editable = !FINAL_STATUSES.has(currentStatus);

  const invalidateList = () =>
    queryClient.invalidateQueries(trpc.documents.list.queryFilter());

  const setStatusMutation = useMutation(
    trpc.documents.setStatus.mutationOptions({
      onSuccess: (updated) => {
        invalidateList();
        toast.success(`Статус изменён: ${documentStatusLabel(updated.status)}`);
      },
      onError: (err) =>
        toast.error(err.message || "Не удалось изменить статус"),
    })
  );
  const deleteMutation = useMutation(
    trpc.documents.delete.mutationOptions({
      onSuccess: () => {
        invalidateList();
        toast.success("Документ удалён");
      },
      onError: (err) =>
        toast.error(err.message || "Не удалось удалить документ"),
    })
  );

  const openBuilder = () =>
    navigate({
      to: "/templates/$templateId/builder",
      params: { templateId },
      search: { documentId: id },
    });

  return (
    <>
      <Link
        className="group block"
        params={{ templateId }}
        search={{ documentId: id }}
        to="/templates/$templateId/builder"
      >
        <div className="flex h-full flex-col gap-3 rounded-2xl border border-[#e5e5e5] bg-card p-4 transition-all hover:border-foreground/20 hover:shadow-sm">
          {/* Counterparty + actions */}
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-muted-foreground text-xs">
              {templateTitle ?? "—"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Действия с документом"
                className="-mt-1 -mr-1 shrink-0 rounded-md p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                // Меню рендерится порталом, но в React-дереве остаётся внутри
                // Link карточки: без stopPropagation клик по пункту всплывает
                // до ссылки и уводит в конструктор.
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {editable && (
                  <DropdownMenuItem onSelect={openBuilder}>
                    <PenLine className="size-4" />
                    Редактировать
                  </DropdownMenuItem>
                )}
                {canChangeStatus ? (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <CircleDashed className="mr-2 size-4 text-muted-foreground" />
                      Поменять статус
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-36">
                      {SETTABLE_STATUSES.map((value) => (
                        <DropdownMenuItem
                          className="justify-between"
                          key={value}
                          onSelect={() =>
                            setStatusMutation.mutate({
                              documentId: id,
                              status: value,
                            })
                          }
                        >
                          {documentStatusLabel(value)}
                          {value === currentStatus && (
                            <Check className="size-4" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ) : (
                  <DropdownMenuItem
                    className="flex-col items-start gap-0"
                    disabled
                  >
                    <span className="flex items-center gap-2">
                      <CircleDashed className="size-4" />
                      Поменять статус
                    </span>
                    <span className="pl-6 text-muted-foreground text-xs">
                      Доступно на платной подписке
                    </span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() => setConfirmDeleteOpen(true)}
                  variant="destructive"
                >
                  <Trash2 className="size-4" />
                  Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Title */}
          <h3 className="line-clamp-2 min-h-[2.75rem] font-semibold text-base text-foreground leading-snug">
            {title}
          </h3>

          {/* Status + last change (по макету) */}
          <div className="mt-auto flex items-center gap-2 pt-2">
            <DocumentStatusBadge status={status} />
            <DocumentDateChip value={updatedAt} />
          </div>
        </div>
      </Link>

      <AlertDialog onOpenChange={setConfirmDeleteOpen} open={confirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
            <AlertDialogDescription>
              «{title}» и вся история его версий будут удалены безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Отменить
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ documentId: id })}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
