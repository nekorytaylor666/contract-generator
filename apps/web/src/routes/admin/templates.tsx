import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { InteractiveDocumentPreview } from "@/components/template-builder/interactive-document-preview";
import { VariableCard } from "@/components/template-builder/variable-card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth-guard";
import {
  detectVariables,
  type MergedVariable,
  mergeWithDetected,
} from "@/lib/template-variable-detector";
import type { TemplateVariable } from "@/routes/templates";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/templates")({
  component: AdminTemplatesPage,
  beforeLoad: async () => {
    const { session } = await requireAdmin();
    return { session };
  },
});

interface TemplateRow {
  id: string;
  title: string;
  description: string | null;
  price: number;
  typstContent: string;
  variables: unknown;
  isPublished: boolean;
  updatedAt: string | Date;
}

interface FormState {
  title: string;
  description: string;
  price: string;
  typstContent: string;
  variables: TemplateVariable[];
  isPublished: boolean;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  price: "0",
  typstContent: "",
  variables: [],
  isPublished: false,
};

const noopValueChange = () => undefined;
const defaultPreviewStyle = { font: "", preset: "comfortable" };

function rowToForm(row: TemplateRow): FormState {
  return {
    title: row.title,
    description: row.description ?? "",
    price: String(row.price),
    typstContent: row.typstContent,
    variables: Array.isArray(row.variables)
      ? (row.variables as TemplateVariable[])
      : [],
    isPublished: row.isPublished,
  };
}

function AdminTemplatesPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listQuery = useQuery(trpc.adminTemplates.list.queryOptions());

  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewMaximized, setPreviewMaximized] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.adminTemplates.list.queryKey(),
    });

  const createMutation = useMutation(
    trpc.adminTemplates.create.mutationOptions({
      onSuccess: () => {
        toast.success("Шаблон создан");
        invalidate();
        closeForm();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.adminTemplates.update.mutationOptions({
      onSuccess: () => {
        toast.success("Шаблон обновлён");
        invalidate();
        closeForm();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.adminTemplates.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Шаблон удалён");
        invalidate();
        setDeletingId(null);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (row: TemplateRow) => {
    setForm(rowToForm(row));
    setEditing(row);
    setCreating(false);
  };

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
  };

  // Auto-sync variables with typst content. Result keeps user-edited fields
  // (label/required/defaultValue/dependsOn) but flags unused/typeMismatch.
  const mergedVariables: MergedVariable[] = useMemo(() => {
    const detected = detectVariables(form.typstContent);
    return mergeWithDetected(form.variables, detected);
  }, [form.typstContent, form.variables]);

  const syncVariablesFromTypst = () => {
    setForm((prev) => ({ ...prev, variables: mergedVariables }));
    toast.success(`Синхронизировано: ${mergedVariables.length} переменных`);
  };

  const handleVariableChange = (index: number, next: TemplateVariable) => {
    const list = mergedVariables.map(({ unused, typeMismatch, ...v }) => v);
    list[index] = next;
    setForm((prev) => ({ ...prev, variables: list }));
  };

  const handleVariableDelete = (index: number) => {
    const list = mergedVariables.map(({ unused, typeMismatch, ...v }) => v);
    list.splice(index, 1);
    setForm((prev) => ({ ...prev, variables: list }));
  };

  // Preview values: fill structural fields (select/boolean/number/date) with
  // defaults so conditional branches render; leave text/textarea empty so the
  // user sees the gray italic placeholder labels (matches the client builder).
  const previewValues = useMemo<Record<string, unknown>>(() => {
    const sample: Record<string, unknown> = {};
    for (const v of mergedVariables) {
      if (v.defaultValue !== undefined) {
        sample[v.name] = v.defaultValue;
        continue;
      }
      switch (v.type) {
        case "boolean":
          sample[v.name] = false;
          break;
        case "number":
          sample[v.name] = 1;
          break;
        case "date":
          sample[v.name] = new Date().toISOString().split("T")[0];
          break;
        case "select":
          sample[v.name] = v.options?.[0] ?? "";
          break;
        default:
          // text/textarea — leave undefined so placeholder shows
          break;
      }
    }
    return sample;
  }, [mergedVariables]);

  const previewVariablesClean = useMemo(
    () => mergedVariables.map(({ unused, typeMismatch, ...v }) => v),
    [mergedVariables]
  );

  const toggleMaximize = () => setPreviewMaximized((v) => !v);

  const addManualVariable = () => {
    setForm((prev) => ({
      ...prev,
      variables: [
        ...prev.variables,
        {
          name: `var${prev.variables.length + 1}`,
          type: "text",
          label: "",
          required: false,
        },
      ],
    }));
  };

  const handleSubmit = () => {
    // Strip detector-only metadata before sending
    const cleanVariables = mergedVariables.map(
      ({ unused, typeMismatch, ...v }) => v
    );
    const payload = {
      title: form.title,
      description: form.description || null,
      price: Number(form.price) || 0,
      typstContent: form.typstContent,
      variables: cleanVariables as never,
      isPublished: form.isPublished,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDialogOpen = creating || editing !== null;

  const unusedCount = mergedVariables.filter((v) => v.unused).length;
  const newDetectedCount = mergedVariables.filter(
    (v) => !form.variables.some((existing) => existing.name === v.name)
  ).length;

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-lg">Админка — шаблоны</h1>
          <p className="truncate text-muted-foreground text-sm">
            Создание и редактирование шаблонов документов
          </p>
        </div>
        <Button className="shrink-0" onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          Новый шаблон
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto p-6">
        {listQuery.isLoading && (
          <div className="text-muted-foreground text-sm">Загрузка...</div>
        )}
        {listQuery.data?.length === 0 && (
          <div className="text-muted-foreground text-sm">Шаблонов пока нет</div>
        )}
        {listQuery.data?.map((row) => (
          <div
            className="flex items-center justify-between rounded-lg border bg-card p-4"
            key={row.id}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{row.title}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    row.isPublished
                      ? "bg-green-100 text-green-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {row.isPublished ? "опубликован" : "черновик"}
                </span>
              </div>
              {row.description && (
                <p className="mt-1 truncate text-muted-foreground text-sm">
                  {row.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => openEdit(row as TemplateRow)}
                size="sm"
                variant="outline"
              >
                <Pencil className="mr-1.5 size-3.5" />
                Изменить
              </Button>
              <Button
                onClick={() => setDeletingId(row.id)}
                size="sm"
                variant="outline"
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog onOpenChange={(open) => !open && closeForm()} open={isDialogOpen}>
        <DialogContent className="!fixed !top-0 !left-0 !w-screen !h-screen !max-w-none !max-h-none !translate-x-0 !translate-y-0 !rounded-none sm:!max-w-none flex flex-col gap-0 overflow-hidden p-0">
          {/* Sticky toolbar — always visible at top */}
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-background px-6 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold text-base">
                {editing ? "Изменить шаблон" : "Новый шаблон"}
              </h2>
              <p className="truncate text-muted-foreground text-xs">
                Переменные определяются автоматически — нажми «Синхронизировать»
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button onClick={toggleMaximize} size="sm" variant="outline">
                {previewMaximized ? (
                  <>
                    <EyeOff className="mr-1.5 size-3.5" />
                    Показать редактор
                  </>
                ) : (
                  <>
                    <Eye className="mr-1.5 size-3.5" />
                    Развернуть превью
                  </>
                )}
              </Button>
              <Button onClick={closeForm} size="sm" variant="outline">
                Отмена
              </Button>
              <Button
                disabled={isSaving || !form.title || !form.typstContent}
                onClick={handleSubmit}
                size="sm"
              >
                {isSaving ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
          {/* Hidden a11y header for Radix */}
          <DialogHeader className="sr-only">
            <DialogTitle>
              {editing ? "Изменить шаблон" : "Новый шаблон"}
            </DialogTitle>
            <DialogDescription>
              Переменные определяются автоматически из текста.
            </DialogDescription>
          </DialogHeader>
          {/* Scrollable body */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6 pb-16">
            <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-[2fr_1fr]">
              <div className="grid gap-2">
                <Label htmlFor="title">Название</Label>
                <Input
                  id="title"
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  value={form.title}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Описание</Label>
                <Input
                  id="description"
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  value={form.description}
                />
              </div>
              <div className="flex gap-3">
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="price">Цена (копейки)</Label>
                  <Input
                    id="price"
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    type="number"
                    value={form.price}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <input
                    checked={form.isPublished}
                    className="size-4"
                    id="published"
                    onChange={(e) =>
                      setForm({ ...form, isPublished: e.target.checked })
                    }
                    type="checkbox"
                  />
                  <Label htmlFor="published">Опубликован</Label>
                </div>
              </div>
            </div>

            <div
              className={`grid min-h-[75vh] grid-cols-1 gap-4 ${
                previewMaximized ? "" : "sm:grid-cols-2"
              }`}
            >
              {/* Left: Typst editor (top) + Variables (below) — equal halves.
                  Hidden when preview is maximized. */}
              {!previewMaximized && (
                <div className="flex h-[80vh] min-h-0 flex-col gap-4">
                  {/* Typst editor */}
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <Label htmlFor="typst">Typst-контент</Label>
                    <Textarea
                      className="min-h-0 flex-1 resize-none font-mono text-xs"
                      id="typst"
                      onChange={(e) =>
                        setForm({ ...form, typstContent: e.target.value })
                      }
                      placeholder="#set page(...)&#10;{{variableName}} ..."
                      value={form.typstContent}
                    />
                  </div>

                  {/* Variables panel */}
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label>Переменные ({mergedVariables.length})</Label>
                      <Button
                        disabled={newDetectedCount === 0}
                        onClick={syncVariablesFromTypst}
                        size="sm"
                        variant="outline"
                      >
                        Синхронизировать
                        {newDetectedCount > 0 && ` (+${newDetectedCount})`}
                      </Button>
                    </div>
                    {unusedCount > 0 && (
                      <p className="text-destructive text-xs">
                        ⚠️ {unusedCount} переменных не используется в шаблоне
                      </p>
                    )}
                    <div className="min-h-0 flex-1 space-y-2 overflow-auto rounded border bg-muted/20 p-2">
                      {mergedVariables.length === 0 && (
                        <p className="px-2 py-4 text-center text-muted-foreground text-xs">
                          Переменные появятся здесь по мере набора Typst-кода
                          (плейсхолдеры вида {"{{name}}"}).
                        </p>
                      )}
                      {mergedVariables.map((v, i) => (
                        <VariableCard
                          allVariables={mergedVariables}
                          key={v.name}
                          onChange={(next) => handleVariableChange(i, next)}
                          onDelete={() => handleVariableDelete(i)}
                          variable={v}
                        />
                      ))}
                    </div>
                    <Button
                      onClick={addManualVariable}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Plus className="mr-1.5 size-3.5" />
                      Добавить вручную
                    </Button>
                  </div>
                </div>
              )}

              {/* Right: Preview — always shown */}
              <div className="flex min-h-0 flex-col gap-2">
                <Label className="text-base">Предпросмотр документа</Label>
                <p className="text-muted-foreground text-xs">
                  Обновляется в реальном времени. Подставлены значения по
                  умолчанию (или плейсхолдеры «[Label]» если defaultValue не
                  задан).
                </p>
                <div
                  className={`overflow-hidden rounded border ${
                    previewMaximized
                      ? "mx-auto h-[95vh] w-full max-w-5xl"
                      : "h-[90vh]"
                  }`}
                >
                  {form.typstContent ? (
                    <InteractiveDocumentPreview
                      logo={null}
                      onValueChange={noopValueChange}
                      style={defaultPreviewStyle}
                      typstContent={form.typstContent}
                      values={previewValues}
                      variables={previewVariablesClean}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                      Введите Typst-контент, чтобы увидеть предпросмотр
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>{" "}
          {/* end scrollable body */}
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => !open && setDeletingId(null)}
        open={deletingId !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить шаблон?</AlertDialogTitle>
            <AlertDialogDescription>
              Действие необратимо. Все версии шаблона тоже будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() =>
                deletingId && deleteMutation.mutate({ id: deletingId })
              }
            >
              {deleteMutation.isPending ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
