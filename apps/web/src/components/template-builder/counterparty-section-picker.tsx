import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";

import {
  CounterpartyFormDialog,
  type CounterpartyRecord,
} from "@/components/counterparties/counterparty-form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildPrefillValues } from "@/lib/counterparty-prefill";
import type { CounterpartyColumn } from "@/lib/native-typst";
import type { TemplateVariable } from "@/routes/templates";
import { useTRPC } from "@/utils/trpc";

// Пункт «+ Добавить контрагента» — служебное значение, реальным value
// селекта не становится (Select контролируемый).
const ADD_SENTINEL = "__add_counterparty__";

// Минимальный контракт поля TanStack Form (как в VariableField): пикер живёт
// внутри собственного form.Field по зарезервированному ключу, чтобы
// handleChange гарантированно дёргал onChange-листенер формы.
interface PickerFieldInstance {
  state: { value: unknown };
  handleChange: (value: unknown) => void;
}

interface CounterpartySectionPickerProps {
  /** Подпись роли: «Поставщик», «Арендодатель»… */
  label: string;
  /** Поле шаблона → колонка контрагента (уже разрешённый маппинг). */
  mapping: Record<string, CounterpartyColumn>;
  variablesByName: ReadonlyMap<string, TemplateVariable>;
  field: PickerFieldInstance;
  setFieldValue: (name: string, value: unknown) => void;
}

/**
 * Пикер «Выбрать из сохранённых» над секцией стороны договора (макет
 * /Редактирование): выбор контрагента префиллит поля секции, пункт
 * «+ Добавить контрагента» открывает мастер и применяет созданного.
 * Скрыт на разовом тарифе (серверный гейт остаётся авторитетным).
 */
export function CounterpartySectionPicker({
  label,
  mapping,
  variablesByName,
  field,
  setFieldValue,
}: CounterpartySectionPickerProps) {
  const trpc = useTRPC();
  const { data: subscription } = useQuery(
    trpc.subscriptions.mySubscription.queryOptions()
  );
  const isPaid = Boolean(subscription?.isPaid);
  const { data: counterparties = [] } = useQuery({
    ...trpc.counterparties.list.queryOptions(),
    enabled: isPaid,
    retry: false,
  });
  const [formOpen, setFormOpen] = useState(false);

  if (!isPaid || Object.keys(mapping).length === 0) {
    return null;
  }

  // Удалённый контрагент вырождается в плейсхолдер; его id в значениях
  // документа безвреден.
  const rawSelected = field.state.value;
  const selectedId =
    typeof rawSelected === "string" &&
    counterparties.some((cp) => cp.id === rawSelected)
      ? rawSelected
      : "";

  const applyCounterparty = (cp: CounterpartyRecord) => {
    const updates = buildPrefillValues(mapping, variablesByName, cp);
    for (const [name, value] of Object.entries(updates)) {
      setFieldValue(name, value);
    }
    // Последним — по смонтированному полю пикера: гарантирует один
    // дебаунс-батч onValuesChange с полным набором значений.
    field.handleChange(cp.id);
  };

  const handleSelect = (value: string) => {
    if (value === ADD_SENTINEL) {
      setFormOpen(true);
      return;
    }
    const picked = counterparties.find((cp) => cp.id === value);
    if (picked) {
      applyCounterparty(picked);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-medium text-foreground text-sm">*{label}:</span>
      <Select onValueChange={handleSelect} value={selectedId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Выбрать из сохранённых" />
        </SelectTrigger>
        <SelectContent>
          {counterparties.map((cp) => (
            <SelectItem key={cp.id} value={cp.id}>
              <span className="flex items-center gap-2">
                {cp.name}
                {/* Тип из справочника — название может ему противоречить
                    (напр. запись «ТОО …» с типом ИП). */}
                {cp.type && (
                  <span className="rounded border border-border px-1 font-medium text-[10px] text-muted-foreground leading-4">
                    {cp.type}
                  </span>
                )}
                {cp.bin && (
                  <span className="text-muted-foreground text-xs">
                    БИН {cp.bin}
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
          {counterparties.length > 0 && <SelectSeparator />}
          <SelectItem value={ADD_SENTINEL}>
            <span className="flex items-center gap-1.5">
              <Plus className="size-4" />
              Добавить контрагента
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">
        Заполните, если не выбрали контрагента из сохранённых
      </p>
      <CounterpartyFormDialog
        counterparty={null}
        onCreated={applyCounterparty}
        onOpenChange={setFormOpen}
        open={formOpen}
      />
    </div>
  );
}
