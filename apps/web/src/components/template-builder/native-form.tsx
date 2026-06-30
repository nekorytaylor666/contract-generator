import { useMemo } from "react";

import { interpretNative } from "@/lib/native-interpreter";
import { parseNativeSections } from "@/lib/native-typst";
import type { TemplateVariable } from "@/routes/templates";

import { isComplexNative } from "./server-typst-preview";
import { type FieldGroup, TemplateForm } from "./template-form";

interface FormApi {
  setFieldValue: (name: string, value: unknown) => void;
  getValues: () => Record<string, unknown>;
}

// Field names are `\w+`, so a comma never collides as a separator.
const FIELD_SEP = ",";
// Section for fields declared before any `// @section` marker.
const DEFAULT_SECTION = "Основные данные";

/**
 * Form sidebar for native templates. Two refinements over a flat field list:
 *
 * 1. For *complex* templates it hides fields gated by an inactive branch — the
 *    interpreter reports which fields are reachable for the current values, so
 *    there's no point asking for fields the document isn't showing.
 * 2. When the template has `// @section` markers, fields are grouped into
 *    collapsible sections (in document order) instead of one long list.
 */
export function NativeForm({
  typstContent,
  values,
  variables,
  formApiRef,
  initialValues,
  isSubmitting,
  onValuesChange,
}: {
  typstContent: string;
  values: Record<string, unknown>;
  variables: TemplateVariable[];
  formApiRef?: React.RefObject<FormApi | null>;
  initialValues?: Record<string, unknown>;
  isSubmitting?: boolean;
  onValuesChange?: (values: Record<string, unknown>) => void;
}) {
  const valuesKey = JSON.stringify(values ?? {});

  // Stable string key — changes only when the reachable set actually changes,
  // so editing a plain field doesn't churn the visible-field list.
  const reachableKey = useMemo(() => {
    if (!isComplexNative(typstContent)) {
      return null;
    }
    const fields = interpretNative(typstContent, JSON.parse(valuesKey))?.fields;
    return fields ? [...fields].sort().join(FIELD_SEP) : null;
  }, [typstContent, valuesKey]);

  const visibleVariables = useMemo(() => {
    if (reachableKey === null) {
      return variables;
    }
    const allowed = new Set(reachableKey.split(FIELD_SEP));
    return variables.filter((variable) => allowed.has(variable.name));
  }, [variables, reachableKey]);

  const sections = useMemo(
    () => parseNativeSections(typstContent),
    [typstContent]
  );

  const groups = useMemo<FieldGroup[] | undefined>(() => {
    if (sections.order.length === 0) {
      return; // no markers → flat form
    }
    const namesByTitle = new Map<string, string[]>();
    for (const variable of visibleVariables) {
      const title = sections.sectionOf.get(variable.name) || DEFAULT_SECTION;
      const names = namesByTitle.get(title) ?? [];
      names.push(variable.name);
      namesByTitle.set(title, names);
    }
    const ordered: FieldGroup[] = [];
    const defaultNames = namesByTitle.get(DEFAULT_SECTION);
    if (defaultNames) {
      ordered.push({ title: DEFAULT_SECTION, names: defaultNames });
    }
    for (const title of sections.order) {
      const names = namesByTitle.get(title);
      if (names && names.length > 0) {
        ordered.push({ title, names });
      }
    }
    return ordered;
  }, [visibleVariables, sections]);

  return (
    <TemplateForm
      formApiRef={formApiRef}
      groups={groups}
      initialValues={initialValues}
      isSubmitting={isSubmitting}
      onValuesChange={onValuesChange}
      variables={visibleVariables}
    />
  );
}
