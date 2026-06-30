import { useMemo } from "react";

import { interpretNativeToMarkup } from "@/lib/native-interpreter";
import type { TemplateVariable } from "@/routes/templates";

import type { DocumentStyle } from "./document-style-settings";
import { InteractiveDocumentPreview } from "./interactive-document-preview";
import { ServerTypstPreview } from "./server-typst-preview";

const FIELD_RE = /\{\{(\w+)\}\}/g;

function humanizeFieldName(name: string): string {
  const words = name.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Ensure every interpreted `{{field}}` has a variable so it renders editable.
// Some fields are declared with a nested `#let` the top-level `parseNativeLets`
// scan misses; back-fill those as plain text inputs.
function withBackfilledFields(
  markup: string,
  variables: TemplateVariable[]
): TemplateVariable[] {
  const known = new Set(variables.map((v) => v.name));
  const extra: TemplateVariable[] = [];
  for (const match of markup.matchAll(FIELD_RE)) {
    const name = match[1];
    if (!known.has(name)) {
      known.add(name);
      extra.push({
        name,
        type: "text",
        label: humanizeFieldName(name),
        required: false,
      });
    }
  }
  return extra.length > 0 ? [...variables, ...extra] : variables;
}

/**
 * Inline-editable preview for *complex* native Typst templates (those using
 * functions, arrays, `.filter`, `for … .enumerate()` loops). The mini Typst
 * interpreter evaluates them against the current field values into flat
 * `{{var}}`-format markup, which the standard interactive preview then renders
 * with click-to-edit fields — same UX as the `{{}}` format.
 *
 * Editing a `#fill` field doesn't change document structure, so the interpreter
 * produces an identical string and InteractiveDocumentPreview (which memoizes
 * its parse on `typstContent`) won't re-parse — keeping editing smooth. Changing
 * a config value (used in a condition/filter) yields different markup and the
 * structure updates. If interpretation fails, we fall back to the server
 * (real-Typst) renderer so the document is never blank.
 */
export function NativeInlinePreview({
  typstContent,
  variables,
  values,
  onValueChange,
  logo,
  style,
  changedVars,
}: {
  typstContent: string;
  variables: TemplateVariable[];
  values: Record<string, unknown>;
  onValueChange: (name: string, value: unknown) => void;
  logo: string | null;
  style: DocumentStyle;
  changedVars?: Set<string>;
}) {
  const valuesKey = JSON.stringify(values ?? {});
  const markup = useMemo(
    () => interpretNativeToMarkup(typstContent, JSON.parse(valuesKey)),
    [typstContent, valuesKey]
  );
  const resolvedVariables = useMemo(
    () =>
      markup === null ? variables : withBackfilledFields(markup, variables),
    [markup, variables]
  );

  if (markup === null) {
    return <ServerTypstPreview typstContent={typstContent} values={values} />;
  }

  return (
    <InteractiveDocumentPreview
      changedVars={changedVars}
      logo={logo}
      onValueChange={onValueChange}
      style={style}
      typstContent={markup}
      values={values}
      variables={resolvedVariables}
    />
  );
}
