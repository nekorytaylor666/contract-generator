import type { TFunction } from "i18next";
import { AlertTriangle, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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
import { splitOptionDescriptor } from "@/lib/native-typst";
import type { MergedVariable } from "@/lib/template-variable-detector";
import type { TemplateVariable } from "@/routes/templates";

interface VariableCardProps {
  variable: MergedVariable;
  allVariables: MergedVariable[];
  onChange: (next: TemplateVariable) => void;
  onDelete: () => void;
}

const TYPE_LABEL_KEYS: Record<TemplateVariable["type"], string> = {
  text: "builder.variables.types.text",
  textarea: "builder.variables.types.textarea",
  number: "builder.variables.types.number",
  date: "builder.variables.types.date",
  boolean: "builder.variables.types.boolean",
  select: "builder.variables.types.select",
};

function typeLabel(t: TFunction, type: TemplateVariable["type"]): string {
  return t(TYPE_LABEL_KEYS[type]);
}

// One option per line; a `//` appends the gray per-option comment.
function formatOptionsText(variable: TemplateVariable): string {
  return (variable.options ?? [])
    .map((option) => {
      const description = variable.optionDescriptions?.[option];
      return description ? `${option} // ${description}` : option;
    })
    .join("\n");
}

export function VariableCard({
  variable,
  allVariables,
  onChange,
  onDelete,
}: VariableCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  // Local buffer for the select-options textarea. Storing only the parsed array
  // and deriving `value` from it would strip the trailing newline the moment you
  // press Enter — making it impossible to start a new option line.
  const [optionsText, setOptionsText] = useState(() =>
    formatOptionsText(variable)
  );
  // Cards are keyed by index in the admin list, so after deleting a variable
  // this card instance starts showing a different one — re-derive the buffer
  // instead of leaking the previous variable's options into it.
  const [optionsTextFor, setOptionsTextFor] = useState(variable.name);
  if (optionsTextFor !== variable.name) {
    setOptionsTextFor(variable.name);
    setOptionsText(formatOptionsText(variable));
  }

  const update = <K extends keyof TemplateVariable>(
    key: K,
    value: TemplateVariable[K]
  ) => {
    onChange({ ...variable, [key]: value });
  };

  // Each line is `Опция // Комментарий` (or `Опция :: Комментарий`) — the
  // comment renders as the gray line under the option in the radio cards.
  const handleOptionsChange = (raw: string) => {
    setOptionsText(raw);
    const options: string[] = [];
    const optionDescriptions: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const { option, description } = splitOptionDescriptor(line);
      if (!option) {
        continue;
      }
      options.push(option);
      if (description) {
        optionDescriptions[option] = description;
      }
    }
    onChange({
      ...variable,
      options,
      optionDescriptions:
        Object.keys(optionDescriptions).length > 0
          ? optionDescriptions
          : undefined,
    });
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
          {typeLabel(t, variable.type)}
        </span>
        {variable.required && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
            {t("builder.variables.requiredBadge")}
          </span>
        )}
        {variable.unused && (
          <span className="ml-auto flex items-center gap-1 text-destructive text-xs">
            <AlertTriangle className="size-3" />
            {t("builder.variables.unused")}
          </span>
        )}
        {variable.typeMismatch && !variable.unused && (
          <span className="ml-auto flex items-center gap-1 text-destructive text-xs">
            <AlertTriangle className="size-3" />
            {t("builder.variables.typeMismatch")}
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t bg-background/50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`name-${variable.name}`}>
                {t("builder.variables.name")}
              </Label>
              <Input
                id={`name-${variable.name}`}
                onChange={(e) => update("name", e.target.value)}
                value={variable.name}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`type-${variable.name}`}>
                {t("builder.variables.type")}
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
                  {Object.keys(TYPE_LABEL_KEYS).map((type) => (
                    <SelectItem key={type} value={type}>
                      {typeLabel(t, type as TemplateVariable["type"])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs" htmlFor={`label-${variable.name}`}>
              {t("builder.variables.label")}
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
              {t("builder.variables.requiredField")}
            </Label>
          </div>

          {variable.type !== "boolean" && (
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`def-${variable.name}`}>
                {t("builder.variables.defaultValue")}
              </Label>
              <Input
                id={`def-${variable.name}`}
                onChange={(e) =>
                  update(
                    "defaultValue",
                    e.target.value === "" ? undefined : e.target.value
                  )
                }
                placeholder={t("builder.variables.optionalPlaceholder")}
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
                {t("builder.variables.defaultOn")}
              </Label>
            </div>
          )}

          {variable.type === "select" && (
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`opt-${variable.name}`}>
                {t("builder.variables.optionsLabel")}
              </Label>
              <Textarea
                className="min-h-20 font-mono text-xs"
                id={`opt-${variable.name}`}
                onChange={(e) => handleOptionsChange(e.target.value)}
                placeholder={t("builder.variables.optionsPlaceholder")}
                value={optionsText}
              />
            </div>
          )}

          {variable.type === "number" && (
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`words-${variable.name}`}>
                {t("builder.variables.wordFormsLabel")}
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
                placeholder={t("builder.variables.wordFormsPlaceholder")}
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
              {t("builder.variables.deleteVariable")}
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
  const { t } = useTranslation();
  const dep = current.dependsOn;
  const otherVars = allVariables.filter((v) => v.name !== current.name);

  return (
    <div className="space-y-1 rounded-md border bg-muted/30 p-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{t("builder.variables.dependsOn")}</Label>
        {dep && (
          <button
            className="text-muted-foreground text-xs hover:text-foreground"
            onClick={() => onChange(undefined)}
            type="button"
          >
            {t("builder.variables.removeCondition")}
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
              <SelectValue
                placeholder={t("builder.variables.fieldPlaceholder")}
              />
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
              <SelectItem value="eq">
                {t("builder.variables.operatorEq")}
              </SelectItem>
              <SelectItem value="neq">
                {t("builder.variables.operatorNeq")}
              </SelectItem>
              <SelectItem value="in">
                {t("builder.variables.operatorIn")}
              </SelectItem>
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
            placeholder={
              dep.operator === "in"
                ? "a, b, c"
                : t("builder.variables.valuePlaceholder")
            }
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
          {t("builder.variables.addCondition")}
        </Button>
      )}
    </div>
  );
}
