import { useForm } from "@tanstack/react-form";
import { useRef, useSyncExternalStore } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import type { TemplateVariable } from "@/routes/templates";
import { VariableField } from "./variable-field";

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

interface TemplateFormProps {
  variables: TemplateVariable[];
  onSubmit: (values: Record<string, unknown>) => void;
  onValuesChange?: (values: Record<string, unknown>) => void;
  isSubmitting?: boolean;
  initialValues?: Record<string, unknown>;
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

  const subscribe = useRef((cb: () => void) => form.store.subscribe(cb)).current;
  const getSnapshot = useRef(() => {
    return depField ? form.state.values[depField] : undefined;
  }).current;

  const depValue = useSyncExternalStore(subscribe, getSnapshot);

  if (
    depField &&
    !isVariableVisible(variable, { [depField]: depValue })
  ) {
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
}: TemplateFormProps) {
  const onValuesChangeRef = useRef(onValuesChange);
  onValuesChangeRef.current = onValuesChange;

  const form = useForm({
    defaultValues: initialValues ?? buildDefaultValues(variables),
    onSubmit: ({ value }) => {
      onSubmit(value);
    },
    validators: {
      onSubmit: buildZodSchema(variables),
    },
    listeners: {
      onChangeDebounceMs: 3000,
      onChange: ({ formApi }) => {
        onValuesChangeRef.current?.(formApi.state.values);
      },
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      {variables.map((variable) =>
        variable.dependsOn ? (
          <ConditionalField
            key={variable.name}
            form={form}
            variable={variable}
            renderField={() => (
              <form.Field name={variable.name}>
                {(field) => <VariableField field={field} variable={variable} />}
              </form.Field>
            )}
          />
        ) : (
          <form.Field key={variable.name} name={variable.name}>
            {(field) => <VariableField field={field} variable={variable} />}
          </form.Field>
        )
      )}

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
    </form>
  );
}
