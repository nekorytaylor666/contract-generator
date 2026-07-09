/** Sweep select-value combinations: find any values where interpretNative
 * returns null (→ silent white ServerTypstPreview fallback), throws, hangs,
 * or yields markup that renders an empty document. */
import { readFileSync } from "node:fs";
import { interpretNative } from "../src/lib/native-interpreter";
import { evaluateCondition } from "../src/lib/typst-evaluator";
import { parseTypstTemplate, type TypstNode } from "../src/lib/typst-parser";

const source = readFileSync(new URL("./template.typ", import.meta.url), "utf8");
const dbVars = JSON.parse(
  readFileSync(new URL("./db-variables.json", import.meta.url), "utf8")
) as {
  name: string;
  type: string;
  options?: string[];
  defaultValue?: unknown;
}[];

const selects = dbVars.filter((v) => v.type === "select");
// Every select can also be "" (the builder initializes them empty).
const domains = selects.map((v) => ({
  name: v.name,
  options: ["", ...(v.options ?? [])],
}));

function baseValues(): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const v of dbVars) {
    values[v.name] = v.type === "boolean" ? false : "";
  }
  return values;
}

function plainTextOf(
  nodes: TypstNode[],
  values: Record<string, unknown>
): string {
  let out = "";
  for (const node of nodes) {
    if (node.type === "text") {
      out += node.content;
    } else if (node.type === "conditional") {
      for (const b of node.branches) {
        if (evaluateCondition(b.condition, values)) {
          out += plainTextOf(b.body, values);
          break;
        }
      }
    } else if ("children" in node && Array.isArray(node.children)) {
      out += plainTextOf(node.children, values);
    } else if (node.type === "grid") {
      for (const cell of node.cells) {
        out += plainTextOf(cell, values);
      }
    }
  }
  return out;
}

let tested = 0;
let failures = 0;
function check(label: string, values: Record<string, unknown>): void {
  tested++;
  const t0 = Date.now();
  let result: ReturnType<typeof interpretNative>;
  try {
    result = interpretNative(source, { ...values });
  } catch (e) {
    failures++;
    console.log(`THROW  [${label}] ${String(e).slice(0, 200)}`);
    return;
  }
  const ms = Date.now() - t0;
  if (ms > 1000) {
    console.log(`SLOW   [${label}] interpret took ${ms}ms`);
  }
  if (result === null) {
    failures++;
    console.log(`NULL   [${label}] → silent ServerTypstPreview fallback`);
    return;
  }
  let parsed: ReturnType<typeof parseTypstTemplate>;
  try {
    parsed = parseTypstTemplate(result.markup);
  } catch (e) {
    failures++;
    console.log(`PARSE-THROW [${label}] ${String(e).slice(0, 200)}`);
    return;
  }
  const text = plainTextOf(parsed.nodes, values);
  if (!text.includes("ДОГОВОР РАЗОВОЙ ПОСТАВКИ")) {
    failures++;
    console.log(
      `EMPTY  [${label}] rendered doc lost its title (${text.length} chars)`
    );
  }
}

// 1) Pairwise: every pair of selects × every option combo (incl. empty).
for (let i = 0; i < domains.length; i++) {
  for (let j = i + 1; j < domains.length; j++) {
    for (const a of domains[i].options) {
      for (const b of domains[j].options) {
        const values = baseValues();
        values[domains[i].name] = a;
        values[domains[j].name] = b;
        check(
          `${domains[i].name}=${a || "∅"} & ${domains[j].name}=${b || "∅"}`,
          values
        );
      }
    }
  }
}
console.log(`pairwise done: ${tested} combos, ${failures} failures`);

// 2) Pairwise again on top of template defaults (all selects at their #let default).
const defaults = baseValues();
for (const v of dbVars) {
  if (v.type === "select" && v.defaultValue !== undefined) {
    defaults[v.name] = v.defaultValue;
  }
}
// DB has no defaults — take them from the template's #let lines instead.
const LET_RE = /^#let\s+(\w+)\s*=\s*"([^"]*)"/gm;
for (const m of source.matchAll(LET_RE)) {
  if (
    m[1] in defaults &&
    typeof defaults[m[1]] === "string" &&
    defaults[m[1]] === ""
  ) {
    defaults[m[1]] = m[2];
  }
}
const before2 = tested;
for (let i = 0; i < domains.length; i++) {
  for (let j = i + 1; j < domains.length; j++) {
    for (const a of domains[i].options) {
      for (const b of domains[j].options) {
        const values = { ...defaults };
        values[domains[i].name] = a;
        values[domains[j].name] = b;
        check(
          `dflt+${domains[i].name}=${a || "∅"} & ${domains[j].name}=${b || "∅"}`,
          values
        );
      }
    }
  }
}
console.log(
  `pairwise-over-defaults done: ${tested - before2} combos, failures so far ${failures}`
);

// 3) Deterministic pseudo-random full combinations (LCG, no Math.random).
let seed = 42;
const rnd = () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seed / 2_147_483_648;
};
const before3 = tested;
for (let n = 0; n < 3000; n++) {
  const values = baseValues();
  for (const d of domains) {
    values[d.name] = d.options[Math.floor(rnd() * d.options.length)];
  }
  values.invoice_required = rnd() < 0.5;
  check(`rand#${n}`, values);
}
console.log(
  `random done: ${tested - before3} combos, total ${tested}, failures ${failures}`
);
