// Typst template parser — handles the subset of Typst used in contract templates.
// NOT a general-purpose Typst parser.

export interface Condition {
  variable: string;
  operator: "==" | "!=";
  value: string;
}

export interface BooleanCondition {
  variable: string;
  operator: "boolean";
}

export type AnyCondition = Condition | BooleanCondition;

export type TypstNode =
  | { type: "text"; content: string }
  | { type: "variable"; name: string }
  | { type: "heading"; level: number; children: TypstNode[] }
  | { type: "bold"; children: TypstNode[] }
  | { type: "paragraph"; children: TypstNode[] }
  | {
      type: "conditional";
      branches: { condition: AnyCondition | "else"; body: TypstNode[] }[];
    }
  | { type: "vspace"; amount: string }
  | { type: "line"; length: string }
  | { type: "align"; alignment: string; children: TypstNode[] }
  | {
      type: "grid";
      columns: string[];
      cells: TypstNode[][];
    }
  | { type: "block"; children: TypstNode[] }
  | { type: "box"; width?: string; children: TypstNode[] }
  | { type: "repeat"; content: string }
  | { type: "image"; height?: string }
  | { type: "strong"; children: TypstNode[] }
  | {
      type: "styledText";
      styles: Record<string, string>;
      children: TypstNode[];
    }
  | { type: "linebreak" }
  | { type: "setting"; property: string; raw: string };

// ── Bracket matching ────────────────────────────────────────

function findMatchingBracket(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "[") {
      depth++;
    } else if (src[i] === "]") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return src.length;
}

function findMatchingParen(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "(") {
      depth++;
    } else if (src[i] === ")") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return src.length;
}

// ── Top-level regex constants ────────────────────────────────

const CONDITION_STRING_RE = /^"{{(\w+)}}"\s*(==|!=)\s*"([^"]*)"/;
const CONDITION_BOOLEAN_RE = /^{{(\w+)}}/;
const GRID_COLUMNS_RE = /columns:\s*\(([^)]+)\)/;
const GRID_CELL_RE = /align\(\w+\)\[/g;
const SET_PROP_RE = /^#set\s+(\w+)\((.+)\)\s*$/;
const VSPACE_RE = /^#v\(([^)]+)\)/;
const LINE_LENGTH_RE = /length:\s*([^,)]+)/;
const IMAGE_HEIGHT_RE = /height:\s*([^,)]+)/;
const ALIGN_RE = /^#align\((\w+)\)\[/;
const BOX_WIDTH_RE = /width:\s*([^,)]+)/;

function parseCondition(expr: string): AnyCondition {
  const strMatch = CONDITION_STRING_RE.exec(expr.trim());
  if (strMatch) {
    return {
      variable: strMatch[1],
      operator: strMatch[2] as "==" | "!=",
      value: strMatch[3],
    };
  }
  const boolMatch = CONDITION_BOOLEAN_RE.exec(expr.trim());
  if (boolMatch) {
    return { variable: boolMatch[1], operator: "boolean" };
  }
  // Fallback — treat as boolean with raw name
  return { variable: expr.trim(), operator: "boolean" };
}

// ── Inline content parser ───────────────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: recursive descent parser requires sequential pattern matching
function parseInline(src: string): TypstNode[] {
  const nodes: TypstNode[] = [];
  let i = 0;

  function flush(text: string) {
    if (text.length > 0) {
      nodes.push({ type: "text", content: text });
    }
  }

  let buf = "";

  while (i < src.length) {
    // Line break \\
    if (src[i] === "\\" && src[i + 1] === "\\") {
      flush(buf);
      buf = "";
      nodes.push({ type: "linebreak" });
      i += 2;
      continue;
    }

    // Variable {{name}}
    if (src[i] === "{" && src[i + 1] === "{") {
      const end = src.indexOf("}}", i + 2);
      if (end !== -1) {
        flush(buf);
        buf = "";
        const name = src.slice(i + 2, end);
        nodes.push({ type: "variable", name });
        i = end + 2;
        continue;
      }
    }

    // Bold *...*
    if (src[i] === "*") {
      const end = src.indexOf("*", i + 1);
      if (end !== -1) {
        flush(buf);
        buf = "";
        const inner = src.slice(i + 1, end);
        nodes.push({ type: "bold", children: parseInline(inner) });
        i = end + 1;
        continue;
      }
    }

    // #strong[...]
    if (src.startsWith("#strong[", i)) {
      flush(buf);
      buf = "";
      const bracketStart = i + 7; // index of '['
      const bracketEnd = findMatchingBracket(src, bracketStart);
      const inner = src.slice(bracketStart + 1, bracketEnd);
      nodes.push({ type: "strong", children: parseInline(inner) });
      i = bracketEnd + 1;
      continue;
    }

    // #text(size: ..., weight: ...)[...]
    if (src.startsWith("#text(", i)) {
      flush(buf);
      buf = "";
      const parenEnd = findMatchingParen(src, i + 5);
      const params = src.slice(i + 6, parenEnd);
      const styles: Record<string, string> = {};
      for (const part of params.split(",")) {
        const [k, v] = part.split(":").map((s) => s.trim());
        if (k && v) {
          styles[k] = v.replace(/"/g, "");
        }
      }
      // Check for [content] after params
      if (src[parenEnd + 1] === "[") {
        const bracketEnd = findMatchingBracket(src, parenEnd + 1);
        const inner = src.slice(parenEnd + 2, bracketEnd);
        nodes.push({
          type: "styledText",
          styles,
          children: parseInline(inner),
        });
        i = bracketEnd + 1;
      } else {
        i = parenEnd + 1;
      }
      continue;
    }

    // #box(width: ...)[...] or #box[...]
    if (src.startsWith("#box(", i) || src.startsWith("#box[", i)) {
      flush(buf);
      buf = "";
      let width: string | undefined;
      let afterParams = i + 4;
      if (src[i + 4] === "(") {
        const parenEnd = findMatchingParen(src, i + 4);
        const params = src.slice(i + 5, parenEnd);
        const wm = BOX_WIDTH_RE.exec(params);
        if (wm) {
          width = wm[1].trim();
        }
        afterParams = parenEnd + 1;
      }
      if (src[afterParams] === "[") {
        const bracketEnd = findMatchingBracket(src, afterParams);
        const inner = src.slice(afterParams + 1, bracketEnd);
        nodes.push({ type: "box", width, children: parseInline(inner) });
        i = bracketEnd + 1;
      } else {
        i = afterParams;
      }
      continue;
    }

    // #repeat[.]
    if (src.startsWith("#repeat[", i)) {
      flush(buf);
      buf = "";
      const bracketEnd = findMatchingBracket(src, i + 7);
      const content = src.slice(i + 8, bracketEnd);
      nodes.push({ type: "repeat", content });
      i = bracketEnd + 1;
      continue;
    }

    // Inline #if ... [...]
    if (src.startsWith("#if ", i)) {
      flush(buf);
      buf = "";
      const condNode = parseInlineConditional(src, i);
      nodes.push(condNode.node);
      i = condNode.end;
      continue;
    }

    buf += src[i];
    i++;
  }

  flush(buf);
  return nodes;
}

// ── Inline conditional parser ───────────────────────────────

function parseInlineConditional(
  src: string,
  start: number
): { node: TypstNode; end: number } {
  const branches: { condition: AnyCondition | "else"; body: TypstNode[] }[] =
    [];
  let i = start;

  // Parse first branch: #if <condition> [body]
  i += 4; // skip "#if "
  const bracketIdx = src.indexOf("[", i);
  if (bracketIdx === -1) {
    return {
      node: { type: "text", content: src.slice(start) },
      end: src.length,
    };
  }
  const condExpr = src.slice(i, bracketIdx).trim();
  const condition = parseCondition(condExpr);
  const bodyEnd = findMatchingBracket(src, bracketIdx);
  const bodyContent = src.slice(bracketIdx + 1, bodyEnd);
  branches.push({ condition, body: parseInline(bodyContent) });
  i = bodyEnd + 1;

  // Parse else if / else branches
  while (i < src.length) {
    // Skip whitespace
    const rest = src.slice(i);
    if (rest.startsWith(" else if ")) {
      i += 9; // " else if "
      const nextBracket = src.indexOf("[", i);
      if (nextBracket === -1) {
        break;
      }
      const elifCond = parseCondition(src.slice(i, nextBracket).trim());
      const elifEnd = findMatchingBracket(src, nextBracket);
      const elifBody = src.slice(nextBracket + 1, elifEnd);
      branches.push({ condition: elifCond, body: parseInline(elifBody) });
      i = elifEnd + 1;
    } else if (rest.startsWith(" else [")) {
      i += 6; // " else "
      const elseEnd = findMatchingBracket(src, i);
      const elseBody = src.slice(i + 1, elseEnd);
      branches.push({ condition: "else", body: parseInline(elseBody) });
      i = elseEnd + 1;
      break;
    } else {
      break;
    }
  }

  return { node: { type: "conditional", branches }, end: i };
}

// ── Block-level conditional parser ──────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: multi-line conditional parsing with branch extraction
function parseBlockConditional(
  lines: string[],
  startLineIdx: number
): { node: TypstNode; endLineIdx: number } {
  // Join all lines until the conditional is fully bracket-closed
  let combined = "";
  let lineIdx = startLineIdx;
  let depth = 0;
  let started = false;

  while (lineIdx < lines.length) {
    const line = lines[lineIdx];
    for (const ch of line) {
      if (ch === "[") {
        depth++;
        started = true;
      } else if (ch === "]") {
        depth--;
      }
    }
    combined += (combined ? "\n" : "") + line;
    lineIdx++;
    if (started && depth === 0) {
      break;
    }
  }

  // Determine if bodies contain block-level content (multi-line with headings/directives)
  const isMultiLine = combined.includes("\n");

  if (!isMultiLine) {
    // Single-line conditional — use inline parser (e.g. gender conditionals)
    const result = parseInlineConditional(combined, 0);
    return { node: result.node, endLineIdx: lineIdx };
  }

  // Multi-line: extract branches manually and parse bodies with block-level parser
  const branches: { condition: AnyCondition | "else"; body: TypstNode[] }[] =
    [];
  let ci = 4; // skip "#if "

  const bracketIdx = combined.indexOf("[", ci);
  if (bracketIdx === -1) {
    return {
      node: { type: "text", content: combined },
      endLineIdx: lineIdx,
    };
  }

  const condExpr = combined.slice(ci, bracketIdx).trim();
  const firstCond = parseCondition(condExpr);
  const firstEnd = findMatchingBracket(combined, bracketIdx);
  const firstBody = combined.slice(bracketIdx + 1, firstEnd);
  branches.push({
    condition: firstCond,
    body: parseTypstTemplate(firstBody).nodes,
  });
  ci = firstEnd + 1;

  // Parse else if / else branches
  // After findMatchingBracket, ci is right after ']'. Rest may start with
  // " else if ..." or "\n] else if ..." depending on formatting.
  while (ci < combined.length) {
    const rest = combined.slice(ci).trimStart();
    if (rest.startsWith("else if ")) {
      ci = combined.length - rest.length + 8; // skip "else if "
      const nb = combined.indexOf("[", ci);
      if (nb === -1) {
        break;
      }
      const elifCond = parseCondition(combined.slice(ci, nb).trim());
      const elifEnd = findMatchingBracket(combined, nb);
      const elifBody = combined.slice(nb + 1, elifEnd);
      branches.push({
        condition: elifCond,
        body: parseTypstTemplate(elifBody).nodes,
      });
      ci = elifEnd + 1;
    } else if (rest.startsWith("else [")) {
      ci = combined.length - rest.length + 5; // skip "else " to point at "["
      const elseEnd = findMatchingBracket(combined, ci);
      const elseBody = combined.slice(ci + 1, elseEnd);
      branches.push({
        condition: "else",
        body: parseTypstTemplate(elseBody).nodes,
      });
      ci = elseEnd + 1;
      break;
    } else {
      break;
    }
  }

  return { node: { type: "conditional", branches }, endLineIdx: lineIdx };
}

// ── Grid parser ─────────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: grid parser handles multiple cell extraction patterns
function parseGrid(
  src: string,
  start: number
): { node: TypstNode; end: number } {
  const parenStart = src.indexOf("(", start);
  const parenEnd = findMatchingParen(src, parenStart);
  const inner = src.slice(parenStart + 1, parenEnd);

  // Extract columns
  const columns: string[] = [];
  const colMatch = GRID_COLUMNS_RE.exec(inner);
  if (colMatch) {
    columns.push(...colMatch[1].split(",").map((s) => s.trim()));
  }

  // Try align(...)[...] pattern first (English templates)
  const cells: TypstNode[][] = [];
  GRID_CELL_RE.lastIndex = 0;
  let match = GRID_CELL_RE.exec(inner);
  while (match !== null) {
    const bracketStart = inner.indexOf("[", match.index);
    const bracketEnd = findMatchingBracket(inner, bracketStart);
    const content = inner.slice(bracketStart + 1, bracketEnd);
    cells.push(parseInline(content));
    match = GRID_CELL_RE.exec(inner);
  }

  // If no align() cells found, look for bare [...] cells at top level (KZ templates)
  if (cells.length === 0) {
    let depth = 0;
    let cellStart = -1;
    // Skip past "columns: (...)" and "gutter: ..." params to find cell brackets
    for (let gi = 0; gi < inner.length; gi++) {
      const ch = inner[gi];
      if (ch === "(" && depth === 0) {
        // Skip nested parens (like columns: (...))
        const pEnd = findMatchingParen(inner, gi);
        gi = pEnd;
        continue;
      }
      if (ch === "[" && depth === 0) {
        depth = 1;
        cellStart = gi;
      } else if (ch === "[") {
        depth++;
      } else if (ch === "]") {
        depth--;
        if (depth === 0 && cellStart !== -1) {
          const content = inner.slice(cellStart + 1, gi);
          // Multi-line cell content — use block parser
          if (content.includes("\n")) {
            cells.push(parseTypstTemplate(content).nodes);
          } else {
            cells.push(parseInline(content));
          }
          cellStart = -1;
        }
      }
    }
  }

  return {
    node: { type: "grid", columns, cells },
    end: parenEnd + 1,
  };
}

// ── Top-level parser ────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: top-level parser dispatches to many block types
export function parseTypstTemplate(source: string): {
  settings: Record<string, string>;
  nodes: TypstNode[];
} {
  const settings: Record<string, string> = {};
  const nodes: TypstNode[] = [];
  const lines = source.split("\n");

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines (paragraph breaks)
    if (trimmed === "") {
      i++;
      continue;
    }

    // Comments
    if (trimmed.startsWith("//")) {
      i++;
      continue;
    }

    // Settings: #set document(...), #set page(...), #set text(...), #set par(...)
    if (trimmed.startsWith("#set ")) {
      const propMatch = SET_PROP_RE.exec(trimmed);
      if (propMatch) {
        settings[propMatch[1]] = propMatch[2];
      }
      i++;
      continue;
    }

    // Headings: == text
    if (trimmed.startsWith("== ")) {
      const headingText = trimmed.slice(3);
      nodes.push({
        type: "heading",
        level: 2,
        children: parseInline(headingText),
      });
      i++;
      continue;
    }

    // #v(amount)
    if (trimmed.startsWith("#v(")) {
      const amountMatch = VSPACE_RE.exec(trimmed);
      if (amountMatch) {
        nodes.push({ type: "vspace", amount: amountMatch[1] });
      }
      i++;
      continue;
    }

    // #line(...)
    if (trimmed.startsWith("#line(")) {
      const lengthMatch = LINE_LENGTH_RE.exec(trimmed);
      nodes.push({ type: "line", length: lengthMatch?.[1]?.trim() ?? "100%" });
      i++;
      continue;
    }

    // #image(...)
    if (trimmed.startsWith("#image(") || trimmed.startsWith("image(")) {
      const heightMatch = IMAGE_HEIGHT_RE.exec(trimmed);
      nodes.push({ type: "image", height: heightMatch?.[1]?.trim() });
      i++;
      continue;
    }

    // #align(alignment)[...]  — may span multiple lines
    if (trimmed.startsWith("#align(")) {
      const alignMatch = ALIGN_RE.exec(trimmed);
      if (alignMatch) {
        const alignment = alignMatch[1];
        // Find closing bracket, possibly spanning multiple lines
        let combined = line;
        let depth = 0;
        let started = false;
        let j = i;
        while (j < lines.length) {
          for (const ch of lines[j]) {
            if (ch === "[") {
              depth++;
              started = true;
            } else if (ch === "]") {
              depth--;
            }
          }
          if (j > i) {
            combined += `\n${lines[j]}`;
          }
          j++;
          if (started && depth === 0) {
            break;
          }
        }
        const bracketStart = combined.indexOf("[");
        const bracketEnd = findMatchingBracket(combined, bracketStart);
        const inner = combined.slice(bracketStart + 1, bracketEnd);
        nodes.push({
          type: "align",
          alignment,
          children: parseInline(inner),
        });
        i = j;
        continue;
      }
    }

    // #grid(...) — may span multiple lines
    if (trimmed.startsWith("#grid(")) {
      let combined = line;
      let depth = 0;
      let j = i;
      while (j < lines.length) {
        for (const ch of lines[j]) {
          if (ch === "(") {
            depth++;
          } else if (ch === ")") {
            depth--;
          }
        }
        if (j > i) {
          combined += `\n${lines[j]}`;
        }
        j++;
        if (depth === 0) {
          break;
        }
      }
      const gridResult = parseGrid(combined, 0);
      nodes.push(gridResult.node);
      i = j;
      continue;
    }

    // #block(...)[ ... ] — may span multiple lines
    if (trimmed.startsWith("#block(")) {
      let combined = line;
      let depth = 0;
      let started = false;
      let j = i;
      while (j < lines.length) {
        for (const ch of lines[j]) {
          if (ch === "[") {
            depth++;
            started = true;
          } else if (ch === "]") {
            depth--;
          }
        }
        if (j > i) {
          combined += `\n${lines[j]}`;
        }
        j++;
        if (started && depth === 0) {
          break;
        }
      }
      const bracketStart = combined.indexOf("[");
      if (bracketStart !== -1) {
        const bracketEnd = findMatchingBracket(combined, bracketStart);
        const inner = combined.slice(bracketStart + 1, bracketEnd);
        // Parse the inner content as blocks
        const innerResult = parseTypstTemplate(inner);
        nodes.push({ type: "block", children: innerResult.nodes });
      }
      i = j;
      continue;
    }

    // Block-level #if conditional
    if (trimmed.startsWith("#if ")) {
      const result = parseBlockConditional(lines, i);
      nodes.push(result.node);
      i = result.endLineIdx;
      continue;
    }

    // Regular text paragraph — collect consecutive non-empty, non-directive lines
    {
      const paraLines: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const t = l.trim();
        if (t === "") {
          break;
        }
        if (t.startsWith("//")) {
          i++;
          continue;
        }
        if (
          t.startsWith("#set ") ||
          t.startsWith("#v(") ||
          t.startsWith("#line(") ||
          t.startsWith("#align(") ||
          t.startsWith("#grid(") ||
          t.startsWith("#block(") ||
          t.startsWith("#image(") ||
          t.startsWith("== ")
        ) {
          break;
        }
        // If a line starts with #if at column 0, it's a block conditional
        if (t.startsWith("#if ") && l.trimStart() === t) {
          break;
        }
        paraLines.push(l);
        i++;
      }
      if (paraLines.length > 0) {
        const paraText = paraLines.join("\n");
        nodes.push({ type: "paragraph", children: parseInline(paraText) });
      }
    }
  }

  return { settings, nodes };
}
