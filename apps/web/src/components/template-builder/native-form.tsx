import { useMemo } from "react";

import { interpretNative } from "@/lib/native-interpreter";
import { type FormSection, parseNativeSections } from "@/lib/native-typst";
import type { TemplateVariable } from "@/routes/templates";

import { isComplexNative } from "./server-typst-preview";
import { TemplateForm } from "./template-form";

interface FormApi {
  setFieldValue: (name: string, value: unknown) => void;
  getValues: () => Record<string, unknown>;
}

// Field names are `\w+`, so a comma never collides as a separator.
const FIELD_SEP = ",";

// Keep only fields the current values make reachable; drop blocks that end up
// empty (a section header still renders if any of its subsections has fields).
function filterSections(
  sections: FormSection[],
  allowed: ReadonlySet<string>
): FormSection[] {
  const result: FormSection[] = [];
  for (const section of sections) {
    const fields = section.fields.filter((name) => allowed.has(name));
    const subsections = section.subsections
      .map((sub) => ({
        ...sub,
        fields: sub.fields.filter((name) => allowed.has(name)),
      }))
      .filter((sub) => sub.fields.length > 0);
    if (fields.length > 0 || subsections.length > 0) {
      result.push({ ...section, fields, subsections });
    }
  }
  return result;
}

/**
 * Form sidebar for native templates. Two refinements over a flat field list:
 *
 * 1. For *complex* templates it hides fields gated by an inactive branch — the
 *    interpreter reports which fields are reachable for the current values, so
 *    there's no point asking for fields the document isn't showing.
 * 2. When the template has `// @section` markers, fields render in numbered
 *    Figma-style sections (with descriptions and `@subsection` sub-blocks).
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

  const allSections = useMemo(
    () => parseNativeSections(typstContent),
    [typstContent]
  );

  const sections = useMemo<FormSection[] | undefined>(() => {
    if (allSections.length === 0) {
      return; // no markers → flat form
    }
    const allowed = new Set(visibleVariables.map((variable) => variable.name));
    return filterSections(allSections, allowed);
  }, [allSections, visibleVariables]);

  return (
    <TemplateForm
      formApiRef={formApiRef}
      initialValues={initialValues}
      isSubmitting={isSubmitting}
      onValuesChange={onValuesChange}
      sections={sections}
      variables={visibleVariables}
    />
  );
}
