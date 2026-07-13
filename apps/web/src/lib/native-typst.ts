import type { TemplateVariable } from "@/routes/templates";

// A top-level `#let name = <literal>` binding (string / true|false / number).
// Functions (`#let f(...) =`), arrays (`= (...)`) and blocks (`= {...}`) don't
// match and are left untouched.
const LET_LINE_REGEX =
  /^#let\s+(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|true|false|-?\d+(?:\.\d+)?)\s*(?:\/\/\s*(.*))?$/;
const QUOTED_OPTION_REGEX = /"([^"]*)"/g;
const LINE_COMMENT_REGEX = /\/\/.*$/;
const STRING_LITERAL_REGEX = /"(?:[^"\\]|\\.)*"/g;
// `name == "literal"` / `name != "literal"` comparisons reveal a field's options
// even when the author didn't add a `// "a" | "b"` comment.
const CONDITION_OPTION_REGEX = /(\w+)\s*[=!]=\s*"([^"]*)"/g;
// `// @section Заголовок :: Описание` marks the start of a form section;
// `// @subsection Заголовок` starts a sub-block inside it. Fields declared after
// a marker (until the next one) belong to that block. These are Typst comments,
// so they don't affect the compiled document.
const SECTION_MARKER_REGEX = /^\/\/\s*@section\s+(.+?)\s*$/;
const SUBSECTION_MARKER_REGEX = /^\/\/\s*@subsection\s+(.+?)\s*$/;
// `// @hint текст` on a field's `#let` line (or the line below) attaches helper
// text to that field. The `//` is already stripped before this runs, so it
// matches the bare `@hint …` payload.
const HINT_MARKER_REGEX = /^@hint\s+(.+)$/;
// `// @label опция :: описание` on the lines ABOVE a `#let` attaches a gray
// description under that option in the radio cards. One line per option; other
// comments and blank lines may sit between the labels and the `#let`.
const LABEL_MARKER_REGEX = /^@label\s+(.+)$/;
// Strip manual numbering ("1. Стороны" → "Стороны") — numbers are auto-assigned.
const LEADING_NUMBER_REGEX = /^\d+(?:\.\d+)*[.)]?\s+/;
// Literals that don't denote select options (empty default, booleans).
const NON_OPTION_LITERALS = new Set(["", "true", "false"]);

function labelFromName(name: string): string {
  const spaced = name.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function unquote(raw: string): string {
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw) as string;
    } catch {
      return raw.slice(1, -1);
    }
  }
  return raw;
}

// Position of the option→description separator in a segment: `::` or `//`,
// whichever comes first. Both are 2 characters long. -1 when absent.
function findDescriptionSeparator(segment: string): number {
  const colonIdx = segment.indexOf("::");
  const slashIdx = segment.indexOf("//");
  if (colonIdx === -1) {
    return slashIdx;
  }
  if (slashIdx === -1) {
    return colonIdx;
  }
  return Math.min(colonIdx, slashIdx);
}

/**
 * Splits `опция :: описание` / `опция // описание` into its parts. Used by the
 * `// @label` payload and by the admin options textarea (one option per line).
 */
export function splitOptionDescriptor(raw: string): {
  option: string;
  description?: string;
} {
  const idx = findDescriptionSeparator(raw);
  if (idx === -1) {
    return { option: raw.trim() };
  }
  const option = raw.slice(0, idx).trim();
  const description = raw.slice(idx + 2).trim();
  return description ? { option, description } : { option };
}

// A `// @label опция :: описание` line (already trimmed) → its parts, or null
// when the line is not a label marker / has no description.
function parseLabelMarker(
  trimmed: string
): { option: string; description: string } | null {
  if (!trimmed.startsWith("//")) {
    return null;
  }
  const match = LABEL_MARKER_REGEX.exec(trimmed.slice(2).trim());
  if (!match) {
    return null;
  }
  const { option, description } = splitOptionDescriptor(match[1]);
  if (option && description) {
    return { option: unquote(option), description };
  }
  return null;
}

// Options for a select come from a pipe-separated comment on the same line or
// the line directly below: `// "a" | "b" | "c"` or `// a | b` or `//a|b`.
// An option may carry a description after `::` (`// a :: описание | b :: …`),
// stripped here and read separately by parseOptionDescriptions.
function parseOptionsComment(comment: string | undefined): string[] | null {
  if (!comment?.includes("|")) {
    return null;
  }
  const quoted = [...comment.matchAll(QUOTED_OPTION_REGEX)].map((m) => m[1]);
  if (quoted.length >= 2) {
    return quoted;
  }
  const bare = comment
    .split("|")
    .map((part) => part.split("::")[0].trim())
    .filter(Boolean);
  return bare.length >= 2 ? bare : null;
}

// `// office :: Административная деятельность | trade :: Розничная продажа`
// → { office: "Административная деятельность", trade: "Розничная продажа" }.
// Descriptions render under each radio-card title. Options without `::` are
// simply absent from the map. `// @label` markers are the preferred syntax;
// this inline form stays for short lists and older templates.
function parseOptionDescriptions(
  comment: string | undefined
): Record<string, string> | null {
  if (!(comment?.includes("::") && comment.includes("|"))) {
    return null;
  }
  const map: Record<string, string> = {};
  for (const segment of comment.split("|")) {
    const idx = segment.indexOf("::");
    if (idx === -1) {
      continue;
    }
    const option = unquote(segment.slice(0, idx).trim());
    const description = segment.slice(idx + 2).trim();
    if (option && description) {
      map[option] = description;
    }
  }
  return Object.keys(map).length > 0 ? map : null;
}

// Helper text for a field comes from a `// @hint …` comment on the same line or
// the line directly below the `#let`.
function parseHintComment(comment: string | undefined): string | null {
  if (!comment) {
    return null;
  }
  const match = HINT_MARKER_REGEX.exec(comment.trim());
  return match ? match[1].trim() : null;
}

// Net bracket depth a line adds, ignoring brackets inside strings/comments.
function depthDelta(line: string): number {
  const cleaned = line
    .replace(LINE_COMMENT_REGEX, "")
    .replace(STRING_LITERAL_REGEX, "");
  let delta = 0;
  for (const ch of cleaned) {
    if (ch === "{" || ch === "[" || ch === "(") {
      delta++;
    } else if (ch === "}" || ch === "]" || ch === ")") {
      delta--;
    }
  }
  return delta;
}

function buildVariable(
  name: string,
  rawValue: string,
  options: string[] | null,
  hint: string | null,
  descriptions: Record<string, string> | null
): TemplateVariable {
  const label = labelFromName(name);
  let variable: TemplateVariable;
  if (options) {
    variable = {
      name,
      type: "select",
      label,
      required: false,
      options,
      defaultValue: unquote(rawValue),
    };
  } else if (rawValue === "true" || rawValue === "false") {
    variable = {
      name,
      type: "boolean",
      label,
      required: false,
      defaultValue: rawValue === "true",
    };
  } else if (rawValue.startsWith('"')) {
    variable = {
      name,
      type: "text",
      label,
      required: false,
      defaultValue: unquote(rawValue),
    };
  } else {
    variable = { name, type: "number", label, required: false };
  }
  if (hint) {
    variable.hint = hint;
  }
  // Attached even for text fields: conditions may upgrade them to select later
  // (inferOptionsFromConditions), and the spread there keeps the descriptions.
  if (descriptions && Object.keys(descriptions).length > 0) {
    variable.optionDescriptions = descriptions;
  }
  return variable;
}

/**
 * Extracts fillable variables from a native Typst template — the top-level
 * `#let name = ""` bindings — as `TemplateVariable`s so they plug into the same
 * form/values machinery as the `{{var}}` format.
 */
function recordLet(
  byName: Map<string, TemplateVariable>,
  name: string,
  rawValue: string,
  sameLineComment: string | undefined,
  nextLine: string | undefined,
  labels: Record<string, string>
): void {
  const nextPayload = nextLine?.startsWith("//")
    ? nextLine.slice(2).trim()
    : undefined;
  // `@`-marker comments (`@label`, `@hint`, `@section`, …) are never option
  // lists: a `@label … | …` for the NEXT field must not be read as this
  // field's options. parseHintComment self-selects via its `@hint` prefix.
  const sameComment = sameLineComment?.startsWith("@")
    ? undefined
    : sameLineComment;
  const nextComment = nextPayload?.startsWith("@") ? undefined : nextPayload;
  const options =
    parseOptionsComment(sameComment) ?? parseOptionsComment(nextComment);
  const hint =
    parseHintComment(sameLineComment) ?? parseHintComment(nextPayload);
  const inline =
    parseOptionDescriptions(sameComment) ??
    parseOptionDescriptions(nextComment);
  const existing = byName.get(name);
  // Descriptions merge across sources: `// @label` markers win over inline
  // `::`, both win over earlier redeclarations.
  const descriptions = {
    ...existing?.optionDescriptions,
    ...inline,
    ...labels,
  };
  // Merge across redeclarations: a select annotation, a `// @hint` or `@label`s
  // may sit on any occurrence (e.g. the first `#let landlord_type = "company"`
  // has no comment but a later one does), so upgrade to select / backfill the
  // hint and descriptions whenever we find them.
  if (existing) {
    if (existing.hint === undefined && hint) {
      existing.hint = hint;
    }
    if (Object.keys(descriptions).length > 0) {
      existing.optionDescriptions = descriptions;
    }
    if (!(options && existing.type !== "select")) {
      return;
    }
  }
  byName.set(
    name,
    buildVariable(
      name,
      rawValue,
      options,
      hint ?? existing?.hint,
      Object.keys(descriptions).length > 0 ? descriptions : null
    )
  );
}

// Collect, per variable name, the distinct string literals it is compared
// against in conditions — its implied select options.
function inferOptionsFromConditions(content: string): Map<string, string[]> {
  const literals = new Map<string, Set<string>>();
  for (const match of content.matchAll(CONDITION_OPTION_REGEX)) {
    const [, name, literal] = match;
    if (NON_OPTION_LITERALS.has(literal)) {
      continue;
    }
    const set = literals.get(name) ?? new Set<string>();
    set.add(literal);
    literals.set(name, set);
  }
  const result = new Map<string, string[]>();
  for (const [name, set] of literals) {
    if (set.size >= 2) {
      result.set(name, [...set]);
    }
  }
  return result;
}

export function parseNativeLets(content: string): TemplateVariable[] {
  const byName = new Map<string, TemplateVariable>();
  const lines = content.split("\n");
  let depth = 0;
  // `// @label` lines collect here until the next top-level `#let` consumes
  // them; other comments and blank lines in between are allowed, any other
  // content discards the pending block.
  let pendingLabels: Record<string, string> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (depth !== 0) {
      pendingLabels = {};
    } else if (trimmed.startsWith("//")) {
      const label = parseLabelMarker(trimmed);
      if (label) {
        pendingLabels[label.option] = label.description;
      }
    } else if (trimmed !== "") {
      const match = LET_LINE_REGEX.exec(trimmed);
      if (match) {
        recordLet(
          byName,
          match[1],
          match[2],
          match[3],
          lines[i + 1]?.trim(),
          pendingLabels
        );
      }
      pendingLabels = {};
    }
    depth = Math.max(0, depth + depthDelta(line));
  }

  // Upgrade plain-text fields to selects when conditions reveal their options
  // (an explicit `// "a" | "b"` comment, handled above, stays authoritative).
  for (const [name, options] of inferOptionsFromConditions(content)) {
    const existing = byName.get(name);
    if (existing?.type === "text") {
      byName.set(name, { ...existing, type: "select", options });
    }
  }

  return [...byName.values()];
}

export interface FormSubsection {
  title: string;
  /** Field names in this sub-block, in declaration order. */
  fields: string[];
}

export interface FormSection {
  title: string;
  description?: string;
  /** Fields directly under the section header (before any subsection). */
  fields: string[];
  subsections: FormSubsection[];
}

// Fields declared before the first `// @section` land here.
export const DEFAULT_SECTION_TITLE = "Основные данные";

function newSection(rawTitle: string): FormSection {
  const [title, description] = rawTitle.split("::").map((part) => part.trim());
  return {
    title: title.replace(LEADING_NUMBER_REGEX, ""),
    description: description || undefined,
    fields: [],
    subsections: [],
  };
}

/**
 * Reads `// @section Заголовок :: Описание` / `// @subsection Заголовок`
 * markers and maps each top-level `#let` field into the section structure the
 * form renders (numbered headers, descriptions, sub-blocks). Returns an empty
 * array when the template has no markers — the form then stays flat.
 */
export function parseNativeSections(content: string): FormSection[] {
  const sections: FormSection[] = [];
  const lines = content.split("\n");
  // First declaration wins — redeclarations (e.g. `#let landlord_type` repeated
  // near the requisites block) must not duplicate the field in later sections.
  const seen = new Set<string>();
  let depth = 0;
  let current: FormSection | null = null;
  let currentSub: FormSubsection | null = null;

  const ensureSection = (): FormSection => {
    if (!current) {
      current = newSection(DEFAULT_SECTION_TITLE);
      sections.unshift(current);
    }
    return current;
  };

  for (const line of lines) {
    if (depth === 0) {
      const trimmed = line.trim();
      const sectionMarker = SECTION_MARKER_REGEX.exec(trimmed);
      const subMarker = SUBSECTION_MARKER_REGEX.exec(trimmed);
      const letMatch = LET_LINE_REGEX.exec(trimmed);
      if (sectionMarker && !subMarker) {
        current = newSection(sectionMarker[1]);
        currentSub = null;
        sections.push(current);
      } else if (subMarker) {
        currentSub = {
          title: subMarker[1].replace(LEADING_NUMBER_REGEX, ""),
          fields: [],
        };
        ensureSection().subsections.push(currentSub);
      } else if (letMatch && !seen.has(letMatch[1])) {
        seen.add(letMatch[1]);
        const target = currentSub ?? ensureSection();
        target.fields.push(letMatch[1]);
      }
    }
    depth = Math.max(0, depth + depthDelta(line));
  }

  // No markers at all → flat form.
  const onlyImplicit =
    sections.length === 1 &&
    sections[0].title === DEFAULT_SECTION_TITLE &&
    sections[0].subsections.length === 0;
  return onlyImplicit ? [] : sections;
}
