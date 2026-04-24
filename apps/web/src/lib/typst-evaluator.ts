import type { AnyCondition } from "./typst-parser";

const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}/;

export function evaluateCondition(
  condition: AnyCondition | "else",
  values: Record<string, unknown>
): boolean {
  if (condition === "else") {
    return true;
  }
  if (condition.operator === "boolean") {
    const v = values[condition.variable];
    return !!v && v !== "false" && v !== "";
  }
  const actual = formatValue(values[condition.variable]) ?? "";
  if (condition.operator === "==") {
    return actual === condition.value;
  }
  return actual !== condition.value;
}

export function formatValue(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value === "string" && DATE_ISO_REGEX.test(value)) {
    return value.split("T")[0];
  }
  return String(value);
}

export function pluralize(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) {
    return forms[2];
  }
  if (last > 1 && last < 5) {
    return forms[1];
  }
  if (last === 1) {
    return forms[0];
  }
  return forms[2];
}

interface TemplateVariableMeta {
  name: string;
  wordForms?: [string, string, string];
}

export function computeDerivedVariables(
  values: Record<string, unknown>,
  templateVars: TemplateVariableMeta[]
): Record<string, unknown> {
  const result = { ...values };
  for (const v of templateVars) {
    if (v.wordForms && typeof result[v.name] === "number") {
      result[`${v.name}Word`] = pluralize(
        result[v.name] as number,
        v.wordForms
      );
    }
  }
  return result;
}
