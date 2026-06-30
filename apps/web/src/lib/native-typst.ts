import type { TemplateVariable } from "@/routes/templates";

// A top-level `#let name = <literal>` binding (string / true|false / number).
// Functions (`#let f(...) =`), arrays (`= (...)`) and blocks (`= {...}`) don't
// match and are left untouched.
const LET_LINE_REGEX =
  /^#let\s+(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|true|false|-?\d+(?:\.\d+)?)\s*(?:\/\/\s*(.*))?$/;
const QUOTED_OPTION_REGEX = /"([^"]*)"/g;
const LINE_COMMENT_REGEX = /\/\/.*$/;
const STRING_LITERAL_REGEX = /"(?:[^"\\]|\\.)*"/g;

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

// Options for a select come from a pipe-separated comment on the same line or
// the line directly below: `// "a" | "b" | "c"` or `// a | b` or `//a|b`.
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
    .map((part) => part.trim())
    .filter(Boolean);
  return bare.length >= 2 ? bare : null;
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
  options: string[] | null
): TemplateVariable {
  const label = labelFromName(name);
  if (options) {
    return {
      name,
      type: "select",
      label,
      required: false,
      options,
      defaultValue: unquote(rawValue),
    };
  }
  if (rawValue === "true" || rawValue === "false") {
    return {
      name,
      type: "boolean",
      label,
      required: false,
      defaultValue: rawValue === "true",
    };
  }
  if (rawValue.startsWith('"')) {
    return {
      name,
      type: "text",
      label,
      required: false,
      defaultValue: unquote(rawValue),
    };
  }
  return { name, type: "number", label, required: false };
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
  nextLine: string | undefined
): void {
  const nextComment = nextLine?.startsWith("//")
    ? nextLine.slice(2).trim()
    : undefined;
  const options =
    parseOptionsComment(sameLineComment) ?? parseOptionsComment(nextComment);
  const existing = byName.get(name);
  // Merge across redeclarations: a select annotation may sit on any occurrence
  // (e.g. the first `#let landlord_type = "company"` has no comment but a later
  // one does), so upgrade to select whenever we find the options.
  if (existing && !(options && existing.type !== "select")) {
    return;
  }
  byName.set(name, buildVariable(name, rawValue, options));
}

export function parseNativeLets(content: string): TemplateVariable[] {
  const byName = new Map<string, TemplateVariable>();
  const lines = content.split("\n");
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (depth === 0) {
      const match = LET_LINE_REGEX.exec(line.trim());
      if (match) {
        recordLet(byName, match[1], match[2], match[3], lines[i + 1]?.trim());
      }
    }
    depth = Math.max(0, depth + depthDelta(line));
  }

  return [...byName.values()];
}
