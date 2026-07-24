import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Plus, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  CounterpartyFormDialog,
  type CounterpartyRecord,
} from "@/components/counterparties/counterparty-form-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/utils/trpc";

const NON_DIGIT_RE = /\D/g;

const TABLE_HEADERS = [
  "Наименование",
  "ИИН/БИН",
  "Юридический адрес",
  "Номер телефона",
  "Почта",
] as const;

function EmptyState({ hasCounterparties }: { hasCounterparties: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-border border-dashed text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        <UserRound className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-foreground text-sm">
          {hasCounterparties
            ? "Ничего не найдено"
            : "У вас пока нет контрагентов"}
        </p>
        <p className="mx-auto mt-1 max-w-[300px] text-muted-foreground text-xs">
          {hasCounterparties
            ? "Попробуйте изменить поисковый запрос"
            : "Добавьте контрагента здесь или при заполнении договора — его реквизиты сохранятся автоматически"}
        </p>
      </div>
    </div>
  );
}

interface CounterpartiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CounterpartiesDialog({
  open,
  onOpenChange,
}: CounterpartiesDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: counterparties = [], isLoading } = useQuery({
    ...trpc.counterparties.list.queryOptions(),
    enabled: open,
  });

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CounterpartyRecord | null>(null);

  // Диалог не размонтируется при закрытии — сбрасываем поиск и выбор,
  // чтобы при повторном открытии не остались скрытый фильтр и «живая» селекция.
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIds(new Set());
    }
  }, [open]);

  const deleteMut = useMutation(
    trpc.counterparties.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.counterparties.list.queryFilter());
        setSelectedIds(new Set());
        toast.success("Удалено");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return counterparties;
    }
    const digits = query.replace(NON_DIGIT_RE, "");
    return counterparties.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (digits.length > 0 && item.bin.includes(digits))
    );
  }, [counterparties, search]);

  // Выбор всегда ⊆ видимых строк: смена поиска снимает галочки со скрытых
  // записей, иначе «Удалить» стёрло бы строки, которых нет на экране.
  useEffect(() => {
    setSelectedIds((prev) => {
      const visibleIds = new Set(visible.map((item) => item.id));
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visible]);

  const allSelected =
    visible.length > 0 && visible.every((item) => selectedIds.has(item.id));

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(visible.map((item) => item.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (record: CounterpartyRecord) => {
    setEditing(record);
    setFormOpen(true);
  };

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="gap-4 sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Контрагенты</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full sm:w-[320px]">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Поиск контрагентов"
                className="h-9 pl-8 text-sm"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Введите наименование или БИН"
                value={search}
              />
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button
                  className="h-9 border-destructive/40 px-4 text-destructive text-sm hover:bg-destructive/10 hover:text-destructive"
                  disabled={deleteMut.isPending}
                  onClick={() => deleteMut.mutate({ ids: [...selectedIds] })}
                  type="button"
                  variant="outline"
                >
                  Удалить
                </Button>
              )}
              <Button
                className="h-9 px-4 text-sm"
                onClick={openCreate}
                type="button"
                variant="outline"
              >
                <Plus className="size-4" />
                Добавить контрагента
              </Button>
            </div>
          </div>

          <div className="h-[420px] overflow-y-auto">
            {isLoading && (
              <p className="py-10 text-center text-muted-foreground text-sm">
                Загрузка контрагентов…
              </p>
            )}

            {!isLoading && visible.length === 0 && (
              <EmptyState hasCounterparties={counterparties.length > 0} />
            )}

            {!isLoading && visible.length > 0 && (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-border border-b">
                    <th className="w-8 py-3 pr-2 text-left">
                      <Checkbox
                        aria-label="Выбрать всех"
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          toggleAll(checked === true)
                        }
                      />
                    </th>
                    {TABLE_HEADERS.map((header) => (
                      <th
                        className="py-3 pr-3 text-left font-medium text-foreground"
                        key={header}
                      >
                        {header}
                      </th>
                    ))}
                    <th className="w-10 py-3">
                      <span className="sr-only">Действия</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr
                      className="border-border/60 border-b last:border-0"
                      key={item.id}
                    >
                      <td className="py-3 pr-2">
                        <Checkbox
                          aria-label={`Выбрать ${item.name}`}
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={(checked) =>
                            toggleRow(item.id, checked === true)
                          }
                        />
                      </td>
                      <td className="max-w-[160px] truncate py-3 pr-3 font-medium text-foreground">
                        {item.name}
                      </td>
                      <td className="py-3 pr-3 text-foreground">{item.bin}</td>
                      <td
                        className="max-w-[140px] truncate py-3 pr-3 text-foreground"
                        title={item.address}
                      >
                        {item.address}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3 text-foreground">
                        {item.phone}
                      </td>
                      <td className="max-w-[150px] truncate py-3 pr-3">
                        <a
                          className="text-foreground underline underline-offset-2 hover:text-muted-foreground"
                          href={`mailto:${item.email}`}
                        >
                          {item.email}
                        </a>
                      </td>
                      <td className="py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-label={`Действия: ${item.name}`}
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            >
                              <Ellipsis className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openEdit(item)}>
                              Редактировать
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() =>
                                deleteMut.mutate({ ids: [item.id] })
                              }
                            >
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CounterpartyFormDialog
        counterparty={editing}
        onOpenChange={setFormOpen}
        open={formOpen}
      />
    </>
  );
}
