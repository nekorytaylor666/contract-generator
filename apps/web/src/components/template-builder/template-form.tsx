import { useForm } from "@tanstack/react-form";
import { ChevronDown } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TemplateVariable } from "@/routes/templates";
import { VariableField } from "./variable-field";

export interface FieldGroup {
  title: string;
  names: string[];
}

// A collapsible form section so the client isn't faced with every field at once.
function FormSection({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button
        className="flex w-full items-center justify-between gap-2 bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/70"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="font-medium text-foreground text-sm">{title}</span>
        <span className="flex items-center gap-2 text-muted-foreground text-xs">
          {count}
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-border border-t px-3 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

function isVariableVisible(
  variable: TemplateVariable,
  values: Record<string, unknown>
): boolean {
  if (!variable.dependsOn) {
    return true;
  }
  const { field, value, operator = "eq" } = variable.dependsOn;
  const currentValue = values[field];

  if (value === undefined) {
    return !!currentValue && currentValue !== "";
  }

  const valuesArray = Array.isArray(value) ? value : [value];

  switch (operator) {
    case "neq":
      return !valuesArray.includes(String(currentValue));
    default:
      return valuesArray.includes(String(currentValue));
  }
}

interface FormApi {
  setFieldValue: (name: string, value: unknown) => void;
  getValues: () => Record<string, unknown>;
}

interface TemplateFormProps {
  variables: TemplateVariable[];
  onSubmit?: (values: Record<string, unknown>) => void;
  onValuesChange?: (values: Record<string, unknown>) => void;
  isSubmitting?: boolean;
  initialValues?: Record<string, unknown>;
  formApiRef?: React.RefObject<FormApi | null>;
  // When provided, fields are rendered in collapsible sections in this order
  // instead of a flat list.
  groups?: FieldGroup[];
}

function buildDefaultValues(
  variables: TemplateVariable[]
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const v of variables) {
    if (v.defaultValue !== undefined) {
      defaults[v.name] = v.defaultValue;
    } else {
      switch (v.type) {
        case "boolean":
          defaults[v.name] = false;
          break;
        case "date":
          defaults[v.name] = undefined;
          break;
        default:
          defaults[v.name] = "";
          break;
      }
    }
  }
  return defaults;
}

function buildZodSchema(variables: TemplateVariable[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const v of variables) {
    let field: z.ZodTypeAny;

    switch (v.type) {
      case "number":
        field = z.union([
          z.number(),
          z.string().transform((val, ctx) => {
            if (val === "") {
              if (v.required) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `${v.label} обязательно для заполнения`,
                });
                return z.NEVER;
              }
              return undefined;
            }
            const parsed = Number(val);
            if (Number.isNaN(parsed)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${v.label} должно быть числом`,
              });
              return z.NEVER;
            }
            return parsed;
          }),
        ]);
        break;
      case "boolean":
        field = z.boolean();
        break;
      case "date":
        field = v.required
          ? z.date({ error: `${v.label} обязательно для заполнения` })
          : z.date().optional();
        break;
      default:
        field = v.required
          ? z.string().min(1, `${v.label} обязательно для заполнения`)
          : z.string();
        break;
    }

    shape[v.name] = field;
  }

  return z.object(shape);
}

/**
 * Wrapper for fields with conditional visibility.
 * Subscribes ONLY to the dependency field value, not all form values.
 */
function ConditionalField({
  variable,
  form,
  renderField,
}: {
  variable: TemplateVariable;
  // biome-ignore lint/suspicious/noExplicitAny: TanStack Form generic inference
  form: any;
  renderField: () => React.ReactNode;
}) {
  const depField = variable.dependsOn?.field;

  const subscribe = useRef((cb: () => void) =>
    form.store.subscribe(cb)
  ).current;
  const getSnapshot = useRef(() => {
    return depField ? form.state.values[depField] : undefined;
  }).current;

  const depValue = useSyncExternalStore(subscribe, getSnapshot);

  if (depField && !isVariableVisible(variable, { [depField]: depValue })) {
    return null;
  }

  return renderField();
}

export function TemplateForm({
  variables,
  onSubmit,
  onValuesChange,
  isSubmitting,
  initialValues,
  formApiRef,
  groups,
}: TemplateFormProps) {
  const onValuesChangeRef = useRef(onValuesChange);
  onValuesChangeRef.current = onValuesChange;

  const form = useForm({
    defaultValues: initialValues ?? buildDefaultValues(variables),
    onSubmit: ({ value }) => {
      onSubmit?.(value);
    },
    validators: {
      onSubmit: buildZodSchema(variables),
    },
    listeners: {
      onChangeDebounceMs: 300,
      onChange: ({ formApi }) => {
        onValuesChangeRef.current?.(formApi.state.values);
      },
    },
  });

  // Expose form API so parent can push values from inline edits
  if (formApiRef) {
    formApiRef.current = {
      setFieldValue: (name: string, value: unknown) => {
        form.setFieldValue(name, value);
      },
      getValues: () => form.state.values,
    };
  }

  const renderField = (variable: TemplateVariable) =>
    variable.dependsOn ? (
      <ConditionalField
        form={form}
        key={variable.name}
        renderField={() => (
          <form.Field name={variable.name}>
            {(field) => <VariableField field={field} variable={variable} />}
          </form.Field>
        )}
        variable={variable}
      />
    ) : (
      <form.Field key={variable.name} name={variable.name}>
        {(field) => <VariableField field={field} variable={variable} />}
      </form.Field>
    );

  const byName = new Map(
    variables.map((variable) => [variable.name, variable])
  );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      {groups
        ? groups.map((group, index) => (
            <FormSection
              count={group.names.length}
              defaultOpen={index === 0}
              key={group.title}
              title={group.title}
            >
              {group.names
                .map((name) => byName.get(name))
                .filter((variable) => variable !== undefined)
                .map((variable) => renderField(variable))}
            </FormSection>
          ))
        : variables.map((variable) => renderField(variable))}

      {onSubmit && (
        <form.Subscribe>
          {(state) => (
            <Button
              className="mt-2 w-full"
              disabled={isSubmitting || state.isSubmitting}
              size="lg"
              type="submit"
            >
              {isSubmitting || state.isSubmitting
                ? "Генерация..."
                : "Сгенерировать PDF"}
            </Button>
          )}
        </form.Subscribe>
      )}
    </form>
  );
}
