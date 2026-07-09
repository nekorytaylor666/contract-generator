import { useMemo, useRef } from "react";

import { interpretNativeToMarkup } from "@/lib/native-interpreter";
import type { TemplateVariable } from "@/routes/templates";

import type { DocumentStyle } from "./document-style-settings";
import { InteractiveDocumentPreview } from "./interactive-document-preview";
import { ServerTypstPreview } from "./server-typst-preview";

const FIELD_RE = /\{\{(\w+)\}\}/g;
// Lines we must not wrap in `#hl[…]`: block constructs, or anything already
// containing brackets (which would break bracket matching).
const BLOCK_LINE_RE =
  /^(#align|#grid|#v\(|#parbreak|#image|#line|#block|#set|#let|#if|=)/;

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

// Wrap plain text lines that are new versus `prev` in `#hl[…]` so the preview
// flashes them yellow and scrolls to the first. Only bracket-free text lines are
// wrapped (block constructs are left alone).
function injectHighlights(prev: string, next: string): string {
  const oldLines = new Set(
    prev
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );
  return next
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (
        !trimmed ||
        // Typst comments (`// @hint`, `// @section`, `// a | b`) are stripped
        // later by the parser — never wrap them, or `#hl[// …]` stops looking
        // like a comment and leaks the raw comment text into the document.
        trimmed.startsWith("//") ||
        oldLines.has(trimmed) ||
        BLOCK_LINE_RE.test(trimmed) ||
        trimmed.includes("[") ||
        trimmed.includes("]")
      ) {
        return line;
      }
      const indent = line.slice(0, line.length - line.trimStart().length);
      // Keep a trailing line break (`\`) outside the highlight bracket.
      let content = trimmed;
      let suffix = "";
      if (content.endsWith("\\")) {
        content = content.slice(0, -1).trimEnd();
        suffix = " \\";
      }
      return content ? `${indent}#hl[${content}]${suffix}` : line;
    })
    .join("\n");
}

/**
 * Inline-editable preview for *complex* native Typst templates. The mini Typst
 * interpreter evaluates them against the current values into flat `{{var}}`
 * markup, which the standard interactive preview renders with click-to-edit
 * fields.
 *
 * Editing a `#fill` field doesn't change document structure, so the interpreter
 * produces an identical string and the preview (which memoizes its parse on
 * `typstContent`) won't re-parse — keeping editing smooth. Changing a select
 * yields different markup; we diff it against the previous markup and wrap the
 * new lines in `#hl[…]` so the preview flashes them yellow and scrolls there,
 * making the effect of the change obvious. If interpretation fails we fall back
 * to the server (real-Typst) renderer so the document is never blank.
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
  const prevCleanRef = useRef<string | null>(null);
  const displayRef = useRef<string | null>(null);

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

  // Recompute the display markup (with `#hl` highlights) only when the structure
  // actually changed; otherwise reuse it so fill-field edits don't re-parse.
  if (markup !== prevCleanRef.current) {
    const prevClean = prevCleanRef.current;
    displayRef.current =
      prevClean === null ? markup : injectHighlights(prevClean, markup);
    prevCleanRef.current = markup;
  }
  const displayMarkup = displayRef.current ?? markup;

  return (
    <InteractiveDocumentPreview
      changedVars={changedVars}
      logo={logo}
      onValueChange={onValueChange}
      style={style}
      typstContent={displayMarkup}
      values={values}
      variables={resolvedVariables}
    />
  );
}
