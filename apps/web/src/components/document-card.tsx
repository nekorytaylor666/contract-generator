import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  CircleDashed,
  Download,
  Info,
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
import { TemplateInfoDialog } from "@/components/template-info-dialog";
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
import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

interface DocumentCardProps {
  id: string;
  title: string;
  templateId: string;
  status: string;
  updatedAt: Date | string;
  /** Момент скачивания PDF — скачанный договор показан серым и не редактируется. */
  downloadedAt?: Date | string | null;
  /** Смена статуса доступна только на платной подписке. */
  canChangeStatus: boolean;
  /** Просто скачанный из каталога шаблон (чип «Шаблон»), иначе — документ
   * из редактора (чип «Редактирование»). */
  templateDownload: boolean;
}

// Финальные статусы: документ уже не редактируют, в меню остаются только
// смена статуса и удаление (как на вкладке «Завершённые» в макете).
const FINAL_STATUSES = new Set(["signed", "expired", "terminated"]);

export function DocumentCard({
  id,
  title,
  templateId,
  status,
  updatedAt,
  downloadedAt,
  canChangeStatus,
  templateDownload,
}: DocumentCardProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const currentStatus = normalizeDocumentStatus(status);
  const downloaded = Boolean(downloadedAt);
  const editable = !(FINAL_STATUSES.has(currentStatus) || downloaded);

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
      {/* Скачанный договор в конструктор не ведёт — ссылка отключена. */}
      <Link
        className={cn("group block", downloaded && "cursor-default")}
        disabled={downloaded}
        params={{ templateId }}
        search={{ documentId: id }}
        to="/templates/$templateId/builder"
      >
        <div
          className={cn(
            "flex h-full flex-col gap-3 rounded-2xl border border-[#e5e5e5] bg-card p-4",
            !downloaded &&
              "transition-all hover:border-foreground/20 hover:shadow-sm"
          )}
        >
          {/* Тип + actions: иконки действий не гасим (по макету) */}
          <div className="flex items-start justify-between gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border border-[#e5e5e5] px-2 py-1 font-semibold text-foreground text-xs leading-4",
                downloaded && "opacity-50"
              )}
            >
              {templateDownload ? (
                <Download className="size-3" />
              ) : (
                <PenLine className="size-3" />
              )}
              {templateDownload ? "Шаблон" : "Редактирование"}
            </span>
            <div className="flex items-center gap-0.5">
              {/* Info — модалка «О договоре» шаблона, как на карточке шаблона */}
              <button
                aria-label="О договоре"
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setInfoOpen(true);
                }}
                type="button"
              >
                <Info className="size-4" />
              </button>
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
          </div>

          {/* Title */}
          <h3
            className={cn(
              "line-clamp-2 min-h-[2.75rem] font-semibold text-base text-foreground leading-snug",
              downloaded && "opacity-50"
            )}
          >
            {title}
          </h3>

          {/* Status + last change (по макету) */}
          <div
            className={cn(
              "mt-auto flex flex-wrap items-center gap-2 pt-2",
              downloaded && "opacity-50"
            )}
          >
            <DocumentStatusBadge status={status} />
            {downloaded && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-muted-foreground text-xs">
                <Download className="size-3.5" />
                Скачан
              </span>
            )}
            <DocumentDateChip value={updatedAt} />
          </div>
        </div>
      </Link>

      <TemplateInfoDialog
        onOpenChange={setInfoOpen}
        open={infoOpen}
        showActions={false}
        templateId={templateId}
      />

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
