import { AlertTriangle, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MergedVariable } from "@/lib/template-variable-detector";
import type { TemplateVariable } from "@/routes/templates";

interface VariableCardProps {
  variable: MergedVariable;
  allVariables: MergedVariable[];
  onChange: (next: TemplateVariable) => void;
  onDelete: () => void;
}

const TYPE_LABELS: Record<TemplateVariable["type"], string> = {
  text: "Текст",
  textarea: "Многострочный",
  number: "Число",
  date: "Дата",
  boolean: "Чекбокс",
  select: "Выбор",
};

export function VariableCard({
  variable,
  allVariables,
  onChange,
  onDelete,
}: VariableCardProps) {
  const [expanded, setExpanded] = useState(false);
  // Local buffer for the select-options textarea. Storing only the parsed array
  // and deriving `value` from it would strip the trailing newline the moment you
  // press Enter — making it impossible to start a new option line.
  const [optionsText, setOptionsText] = useState(
    (variable.options ?? []).join("\n")
  );

  const update = <K extends keyof TemplateVariable>(
    key: K,
    value: TemplateVariable[K]
  ) => {
    onChange({ ...variable, [key]: value });
  };

  const isDangerous = variable.unused || variable.typeMismatch;

  return (
    <div
      className={`rounded-lg border bg-card ${
        isDangerous ? "border-destructive/50" : ""
      }`}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        {expanded ? (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        )}
        <span className="font-mono text-sm">{variable.name}</span>
        <span className="text-muted-foreground text-xs">
          {TYPE_LABELS[variable.type]}
        </span>
        {variable.required && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
            обяз.
          </span>
        )}
        {variable.unused && (
          <span className="ml-auto flex items-center gap-1 text-destructive text-xs">
            <AlertTriangle className="size-3" />
            не используется
          </span>
        )}
        {variable.typeMismatch && !variable.unused && (
          <span className="ml-auto flex items-center gap-1 text-destructive text-xs">
            <AlertTriangle className="size-3" />
            тип не совпадает
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t bg-background/50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`name-${variable.name}`}>
                Имя
              </Label>
              <Input
                id={`name-${variable.name}`}
                onChange={(e) => update("name", e.target.value)}
                value={variable.name}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`type-${variable.name}`}>
                Тип
              </Label>
              <Select
                onValueChange={(v) =>
                  update("type", v as TemplateVariable["type"])
                }
                value={variable.type}
              >
                <SelectTrigger id={`type-${variable.name}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([t, l]) => (
                    <SelectItem key={t} value={t}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs" htmlFor={`label-${variable.name}`}>
              Подпись (Label)
            </Label>
            <Input
              id={`label-${variable.name}`}
              onChange={(e) => update("label", e.target.value)}
              value={variable.label}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={variable.required}
              id={`req-${variable.name}`}
              onCheckedChange={(c) => update("required", c === true)}
            />
            <Label
              className="cursor-pointer text-xs"
              htmlFor={`req-${variable.name}`}
            >
              Обязательное поле
            </Label>
          </div>

          {variable.type !== "boolean" && (
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`def-${variable.name}`}>
                Значение по умолчанию
              </Label>
              <Input
                id={`def-${variable.name}`}
                onChange={(e) =>
                  update(
                    "defaultValue",
                    e.target.value === "" ? undefined : e.target.value
                  )
                }
                placeholder="(необязательно)"
                type={variable.type === "number" ? "number" : "text"}
                value={
                  variable.defaultValue === undefined
                    ? ""
                    : String(variable.defaultValue)
                }
              />
            </div>
          )}

          {variable.type === "boolean" && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={variable.defaultValue === true}
                id={`bool-def-${variable.name}`}
                onCheckedChange={(c) => update("defaultValue", c === true)}
              />
              <Label
                className="cursor-pointer text-xs"
                htmlFor={`bool-def-${variable.name}`}
              >
                По умолчанию включён
              </Label>
            </div>
          )}

          {variable.type === "select" && (
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`opt-${variable.name}`}>
                Опции (по одной на строку)
              </Label>
              <Textarea
                className="min-h-20 font-mono text-xs"
                id={`opt-${variable.name}`}
                onChange={(e) => {
                  const raw = e.target.value;
                  setOptionsText(raw);
                  update(
                    "options",
                    raw
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  );
                }}
                placeholder="Опция 1&#10;Опция 2"
                value={optionsText}
              />
            </div>
          )}

          {variable.type === "number" && (
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`words-${variable.name}`}>
                Склонения (через запятую: 1, 2-4, 5+)
              </Label>
              <Input
                id={`words-${variable.name}`}
                onChange={(e) => {
                  const parts = e.target.value.split(",").map((s) => s.trim());
                  update(
                    "wordForms",
                    parts.length === 3
                      ? (parts as [string, string, string])
                      : undefined
                  );
                }}
                placeholder="день, дня, дней"
                value={(variable.wordForms ?? []).join(", ")}
              />
            </div>
          )}

          <DependsOnEditor
            allVariables={allVariables}
            current={variable}
            onChange={(dep) => update("dependsOn", dep)}
          />

          <div className="flex justify-end pt-1">
            <Button
              onClick={onDelete}
              size="sm"
              type="button"
              variant="outline"
            >
              <Trash2 className="mr-1.5 size-3 text-destructive" />
              Удалить переменную
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface DependsOnEditorProps {
  current: TemplateVariable;
  allVariables: TemplateVariable[];
  onChange: (dep: TemplateVariable["dependsOn"] | undefined) => void;
}

function DependsOnEditor({
  current,
  allVariables,
  onChange,
}: DependsOnEditorProps) {
  const dep = current.dependsOn;
  const otherVars = allVariables.filter((v) => v.name !== current.name);

  return (
    <div className="space-y-1 rounded-md border bg-muted/30 p-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Условная видимость (dependsOn)</Label>
        {dep && (
          <button
            className="text-muted-foreground text-xs hover:text-foreground"
            onClick={() => onChange(undefined)}
            type="button"
          >
            убрать
          </button>
        )}
      </div>
      {dep ? (
        <div className="grid grid-cols-3 gap-1">
          <Select
            onValueChange={(v) => onChange({ ...dep, field: v })}
            value={dep.field}
          >
            <SelectTrigger>
              <SelectValue placeholder="Поле" />
            </SelectTrigger>
            <SelectContent>
              {otherVars.map((v) => (
                <SelectItem key={v.name} value={v.name}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            onValueChange={(v) =>
              onChange({ ...dep, operator: v as "eq" | "neq" | "in" })
            }
            value={dep.operator ?? "eq"}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eq">равно</SelectItem>
              <SelectItem value="neq">не равно</SelectItem>
              <SelectItem value="in">входит в</SelectItem>
            </SelectContent>
          </Select>
          <Input
            onChange={(e) => {
              const raw = e.target.value;
              if (dep.operator === "in") {
                onChange({
                  ...dep,
                  value: raw.split(",").map((s) => s.trim()),
                });
              } else {
                onChange({ ...dep, value: raw });
              }
            }}
            placeholder={dep.operator === "in" ? "a, b, c" : "значение"}
            value={
              Array.isArray(dep.value)
                ? dep.value.join(", ")
                : (dep.value ?? "")
            }
          />
        </div>
      ) : (
        <Button
          onClick={() => onChange({ field: "", operator: "eq", value: "" })}
          size="sm"
          type="button"
          variant="outline"
        >
          + добавить условие
        </Button>
      )}
    </div>
  );
}
