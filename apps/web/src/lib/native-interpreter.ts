/**
 * Mini Typst interpreter for *native* templates.
 *
 * Evaluates the subset of Typst these contract templates use — `#let` bindings &
 * functions, `#if/else`, arrays with conditional items + `.filter`, `for …
 * .enumerate()` loops, comparisons — against the current field values, and
 * re-emits the result as flat `{{var}}`-format Typst. The existing parser +
 * InteractiveDocumentPreview then render it with inline editing. `#fill(name,…)`
 * and bare `#name` references become editable `{{name}}` fields.
 *
 * Deliberately forgiving: anything it can't evaluate degrades to text/skips, and
 * `interpretNativeToMarkup` returns `null` on a hard failure so callers can fall
 * back to the server (real-Typst) renderer.
 */

type Node =
  | { t: "str"; v: string }
  | { t: "num"; v: number }
  | { t: "bool"; v: boolean }
  | { t: "none" }
  | { t: "ident"; name: string }
  | { t: "content"; src: string }
  | { t: "block"; src: string }
  | { t: "array"; items: Node[] }
  | { t: "call"; callee: Node; args: Node[] }
  | { t: "method"; target: Node; name: string; args: Node[] }
  | { t: "field"; target: Node; name: string }
  | { t: "binary"; op: string; left: Node; right: Node }
  | { t: "if"; cond: Node; then: Node; els?: Node }
  | { t: "closure"; param: string; body: Node }
  | { t: "named"; name: string; value: Node };

const IDENT_START = /[A-Za-z_]/;
const IDENT_CHAR = /[A-Za-z0-9_]/;
const WS = /\s/;
const SPACE_TAB = /[ \t]/;
const DIGIT = /[0-9]/;
const NUM_CHAR = /[0-9.]/;
const FILL_FIELD_RE = /^\w+$/;
const LET_LITERAL_RE =
  /^(?:#)?let\s+\w+\s*=\s*(?:"(?:[^"\\]|\\.)*"|true|false|-?\d+(?:\.\d+)?)\s*$/;
const NAMED_ARG_RE = /^[\w-]+$/;
const CELL_CALL_RE = /^\w+\s*\(/;
const CALL_HEAD_RE = /^#(\w+)\s*\(/;
const IDENT_HEAD_RE = /^#(\w+)/;

// ── Expression parser (code mode) ───────────────────────────────
class P {
  src: string;
  i = 0;
  constructor(src: string) {
    this.src = src;
  }
  ws() {
    while (this.i < this.src.length && WS.test(this.src[this.i])) {
      this.i++;
    }
  }
  c(): string {
    return this.src[this.i];
  }
  starts(s: string): boolean {
    return this.src.startsWith(s, this.i);
  }
  word(s: string): boolean {
    return (
      this.starts(s) && !IDENT_CHAR.test(this.src[this.i + s.length] ?? "")
    );
  }
  parse(): Node {
    return this.logical();
  }
  logical(): Node {
    let left = this.compare();
    for (;;) {
      this.ws();
      if (this.word("or")) {
        this.i += 2;
        left = { t: "binary", op: "or", left, right: this.compare() };
      } else if (this.word("and")) {
        this.i += 3;
        left = { t: "binary", op: "and", left, right: this.compare() };
      } else {
        return left;
      }
    }
  }
  compare(): Node {
    const left = this.additive();
    this.ws();
    if (this.starts("==")) {
      this.i += 2;
      return { t: "binary", op: "==", left, right: this.additive() };
    }
    if (this.starts("!=")) {
      this.i += 2;
      return { t: "binary", op: "!=", left, right: this.additive() };
    }
    return left;
  }
  additive(): Node {
    let left = this.postfix();
    for (;;) {
      this.ws();
      const ch = this.c();
      if (ch === "+" || ch === "-") {
        this.i++;
        left = { t: "binary", op: ch, left, right: this.postfix() };
      } else {
        return left;
      }
    }
  }
  postfix(): Node {
    let e = this.primary();
    for (;;) {
      this.ws();
      const ch = this.c();
      if (ch === "(") {
        e = { t: "call", callee: e, args: this.args() };
      } else if (ch === "." && IDENT_START.test(this.src[this.i + 1] ?? "")) {
        this.i++;
        const name = this.ident();
        if (this.c() === "(") {
          e = { t: "method", target: e, name, args: this.args() };
        } else {
          e = { t: "field", target: e, name };
        }
      } else {
        return e;
      }
    }
  }
  args(): Node[] {
    this.i++; // (
    const out: Node[] = [];
    for (;;) {
      this.ws();
      if (this.c() === ")" || this.i >= this.src.length) {
        this.i++;
        return out;
      }
      out.push(this.argItem());
      this.ws();
      if (this.c() === ",") {
        this.i++;
      }
    }
  }
  argItem(): Node {
    const save = this.i;
    this.ws();
    if (IDENT_START.test(this.c() ?? "")) {
      const id = this.ident();
      this.ws();
      if (this.starts("=>")) {
        this.i += 2;
        return { t: "closure", param: id, body: this.parse() };
      }
      if (this.c() === ":") {
        this.i++;
        return { t: "named", name: id, value: this.parse() };
      }
      this.i = save;
    }
    return this.parse();
  }
  primary(): Node {
    this.ws();
    const ch = this.c();
    if (ch === '"') {
      return { t: "str", v: this.str() };
    }
    if (ch === "[") {
      return { t: "content", src: this.delim("[", "]") };
    }
    if (ch === "{") {
      return { t: "block", src: this.delim("{", "}") };
    }
    if (ch === "(") {
      const items = this.args();
      if (items.length === 1 && items[0].t !== "named") {
        return items[0];
      }
      return { t: "array", items };
    }
    if (ch === "#") {
      this.i++;
      return this.primary();
    }
    if (DIGIT.test(ch ?? "")) {
      return { t: "num", v: this.num() };
    }
    if (IDENT_START.test(ch ?? "")) {
      const name = this.ident();
      if (name === "true") {
        return { t: "bool", v: true };
      }
      if (name === "false") {
        return { t: "bool", v: false };
      }
      if (name === "none") {
        return { t: "none" };
      }
      if (name === "if") {
        return this.ifExpr();
      }
      return { t: "ident", name };
    }
    this.i++;
    return { t: "none" };
  }
  ifExpr(): Node {
    const cond = this.parse();
    this.ws();
    const then = this.branch();
    this.ws();
    let els: Node | undefined;
    if (this.word("else")) {
      this.i += 4;
      this.ws();
      if (this.word("if")) {
        this.i += 2;
        els = this.ifExpr();
      } else {
        els = this.branch();
      }
    }
    return { t: "if", cond, then, els };
  }
  branch(): Node {
    this.ws();
    if (this.c() === "[") {
      return { t: "content", src: this.delim("[", "]") };
    }
    if (this.c() === "{") {
      return { t: "block", src: this.delim("{", "}") };
    }
    return this.parse();
  }
  ident(): string {
    let s = "";
    while (this.i < this.src.length && IDENT_CHAR.test(this.src[this.i])) {
      s += this.src[this.i++];
    }
    return s;
  }
  num(): number {
    let s = "";
    while (this.i < this.src.length && NUM_CHAR.test(this.src[this.i])) {
      s += this.src[this.i++];
    }
    return Number(s);
  }
  str(): string {
    this.i++;
    let s = "";
    while (this.i < this.src.length && this.src[this.i] !== '"') {
      if (this.src[this.i] === "\\") {
        s += this.src[this.i + 1];
        this.i += 2;
      } else {
        s += this.src[this.i++];
      }
    }
    this.i++;
    return s;
  }
  delim(open: string, close: string): string {
    this.i++;
    const start = this.i;
    let depth = 1;
    while (this.i < this.src.length && depth > 0) {
      const ch = this.src[this.i];
      if (ch === '"') {
        this.str();
        continue;
      }
      if (ch === "/" && this.src[this.i + 1] === "/") {
        const nl = this.src.indexOf("\n", this.i);
        this.i = nl === -1 ? this.src.length : nl;
        continue;
      }
      if (ch === open) {
        depth++;
      } else if (ch === close) {
        depth--;
        if (depth === 0) {
          break;
        }
      }
      this.i++;
    }
    const inner = this.src.slice(start, this.i);
    this.i++;
    return inner;
  }
}

// ── Values ──────────────────────────────────────────────────────
type Val =
  | { k: "str"; s: string }
  | { k: "num"; n: number }
  | { k: "bool"; b: boolean }
  | { k: "none" }
  | { k: "arr"; items: Val[] }
  | { k: "content"; src: string; code: boolean }
  | { k: "ref"; name: string }
  | { k: "fn"; params: Param[]; body: string; code: boolean };

interface Param {
  name: string;
  def?: Node;
}

const NONE: Val = { k: "none" };

class Interp {
  scope = new Map<string, Val>();
  values: Record<string, unknown>;
  depth = 0;
  constructor(values: Record<string, unknown>) {
    this.values = values;
  }

  fieldVal(name: string): Val {
    const raw = this.values[name];
    if (typeof raw === "string") {
      return { k: "str", s: raw };
    }
    if (typeof raw === "number") {
      return { k: "num", n: raw };
    }
    if (typeof raw === "boolean") {
      return { k: "bool", b: raw };
    }
    return { k: "str", s: "" };
  }

  toStr(v: Val): string {
    switch (v.k) {
      case "str":
        return v.s;
      case "num":
        return String(v.n);
      case "bool":
        return v.b ? "true" : "false";
      case "ref":
        return this.toStr(this.fieldVal(v.name));
      default:
        return "";
    }
  }

  toNum(v: Val): number {
    if (v.k === "num") {
      return v.n;
    }
    if (v.k === "ref") {
      return this.toNum(this.fieldVal(v.name));
    }
    return Number(this.toStr(v)) || 0;
  }

  truthy(v: Val): boolean {
    switch (v.k) {
      case "bool":
        return v.b;
      case "ref":
        return this.truthy(this.fieldVal(v.name));
      case "none":
        return false;
      case "str":
        return v.s.length > 0;
      default:
        return true;
    }
  }

  toMarkup(v: Val): string {
    switch (v.k) {
      case "ref":
        return `{{${v.name}}}`;
      case "str":
        return v.s;
      case "num":
        return String(v.n);
      case "bool":
        return v.b ? "true" : "false";
      case "content":
        return v.code ? this.evalCode(v.src) : this.evalMarkup(v.src);
      case "arr":
        return v.items.map((it) => this.toMarkup(it)).join("");
      default:
        return "";
    }
  }

  evalNode(n: Node): Val {
    switch (n.t) {
      case "str":
        return { k: "str", s: n.v };
      case "num":
        return { k: "num", n: n.v };
      case "bool":
        return { k: "bool", b: n.v };
      case "none":
        return NONE;
      case "content":
        return { k: "content", src: n.src, code: false };
      case "block":
        return { k: "content", src: n.src, code: true };
      case "ident":
        return this.scope.get(n.name) ?? { k: "ref", name: n.name };
      case "array":
        return { k: "arr", items: n.items.map((it) => this.evalNode(it)) };
      case "binary":
        return this.evalBinary(n);
      case "if":
        if (this.truthy(this.evalNode(n.cond))) {
          return this.evalNode(n.then);
        }
        return n.els ? this.evalNode(n.els) : NONE;
      case "method":
        return this.evalMethod(n);
      case "call":
        return this.evalCall(n);
      default:
        return NONE;
    }
  }

  evalBinary(n: Node & { t: "binary" }): Val {
    if (n.op === "or") {
      return {
        k: "bool",
        b:
          this.truthy(this.evalNode(n.left)) ||
          this.truthy(this.evalNode(n.right)),
      };
    }
    if (n.op === "and") {
      return {
        k: "bool",
        b:
          this.truthy(this.evalNode(n.left)) &&
          this.truthy(this.evalNode(n.right)),
      };
    }
    if (n.op === "+" || n.op === "-") {
      const a = this.toNum(this.evalNode(n.left));
      const b = this.toNum(this.evalNode(n.right));
      return { k: "num", n: n.op === "+" ? a + b : a - b };
    }
    const l = this.toStr(this.evalNode(n.left));
    const r = this.toStr(this.evalNode(n.right));
    return { k: "bool", b: n.op === "==" ? l === r : l !== r };
  }

  evalMethod(n: Node & { t: "method" }): Val {
    const target = this.evalNode(n.target);
    if (n.name === "filter" && target.k === "arr") {
      return { k: "arr", items: target.items.filter((it) => it.k !== "none") };
    }
    return target;
  }

  evalCall(n: Node & { t: "call" }): Val {
    if (n.callee.t === "ident") {
      if (n.callee.name === "fill") {
        return { k: "ref", name: this.firstArgName(n.args) };
      }
      const fn = this.scope.get(n.callee.name);
      if (fn?.k === "fn") {
        return { k: "content", src: this.callFn(fn, n.args), code: false };
      }
    }
    return NONE;
  }

  firstArgName(args: Node[]): string {
    const first = args.find((a) => a.t !== "named");
    if (first?.t === "ident") {
      // Resolve a function param to the real field it was bound to, so e.g.
      // `#fill(sign_role)` in party_details(landlord_sign_role) yields the
      // distinct `{{landlord_sign_role}}` rather than the shared param name.
      const bound = this.scope.get(first.name);
      return bound?.k === "ref" ? bound.name : first.name;
    }
    return "field";
  }

  callFn(fn: Val & { k: "fn" }, args: Node[]): string {
    this.depth++;
    if (this.depth > 3000) {
      this.depth--;
      return "";
    }
    const saved = this.scope;
    const local = new Map(saved);
    const positional = args.filter((a) => a.t !== "named");
    fn.params.forEach((p, idx) => {
      const arg = positional[idx];
      if (arg) {
        local.set(p.name, this.argVal(arg));
      } else if (p.def) {
        local.set(p.name, this.evalNode(p.def));
      }
    });
    this.scope = local;
    const out = fn.code ? this.evalCode(fn.body) : this.evalMarkup(fn.body);
    this.scope = saved;
    this.depth--;
    return out;
  }

  argVal(arg: Node): Val {
    if (arg.t === "ident") {
      return this.scope.get(arg.name) ?? { k: "ref", name: arg.name };
    }
    return this.evalNode(arg);
  }

  // ── markup → flat {{}} typst ──────────────────────────────────
  evalMarkup(src: string): string {
    let out = "";
    let i = 0;
    while (i < src.length) {
      if (src[i] === "#") {
        const r = this.hash(src, i);
        out += r.text;
        i = r.next;
        continue;
      }
      // Bare `[…]` content group — grouping only, brackets aren't rendered.
      // (`#fn[…]` wrappers are already consumed by `hash`, so any `[` reaching
      // here starts a plain content block.)
      if (src[i] === "[") {
        const bp = new P(src.slice(i));
        const inner = bp.delim("[", "]");
        out += this.evalMarkup(inner);
        i += bp.i;
        continue;
      }
      out += src[i];
      i++;
    }
    return out;
  }

  hash(src: string, at: number): { text: string; next: number } {
    if (src.startsWith("#let ", at)) {
      return { text: "", next: this.declareLet(src, at + 5) };
    }
    if (src.startsWith("#fill(", at)) {
      const p = new P(src.slice(at + 1));
      p.ident();
      const args = p.args();
      return { text: `{{${this.firstArgName(args)}}}`, next: at + 1 + p.i };
    }
    if (src.startsWith("#if ", at)) {
      return this.markupIf(src, at);
    }
    if (src[at + 1] === "(") {
      const p = new P(src.slice(at + 1));
      const items = p.args();
      const v = items.length === 1 ? this.evalNode(items[0]) : NONE;
      return { text: this.toMarkup(v), next: at + 1 + p.i };
    }
    const layout = this.tryLayout(src, at);
    if (layout) {
      return layout;
    }
    const callM = CALL_HEAD_RE.exec(src.slice(at));
    if (callM && this.scope.get(callM[1])?.k === "fn") {
      const p = new P(src.slice(at + 1));
      p.ident();
      const args = p.args();
      const fn = this.scope.get(callM[1]) as Val & { k: "fn" };
      return { text: this.callFn(fn, args), next: at + 1 + p.i };
    }
    const idM = IDENT_HEAD_RE.exec(src.slice(at));
    if (idM) {
      const name = idM[1];
      const next = at + idM[0].length;
      const v = this.scope.get(name);
      if (v && v.k !== "fn") {
        return { text: this.toMarkup(v), next };
      }
      if (FILL_FIELD_RE.test(name)) {
        return { text: `{{${name}}}`, next };
      }
    }
    return { text: src[at], next: at + 1 };
  }

  // Layout helpers that keep the Typst wrapper but evaluate inner content.
  tryLayout(src: string, at: number): { text: string; next: number } | null {
    for (const fn of ["align", "text", "box", "strong"]) {
      if (src.startsWith(`#${fn}(`, at) || src.startsWith(`#${fn}[`, at)) {
        return this.wrapper(src, at, fn);
      }
    }
    if (src.startsWith("#grid(", at)) {
      return this.grid(src, at);
    }
    for (const fn of ["v", "parbreak", "line", "image", "h"]) {
      if (src.startsWith(`#${fn}(`, at)) {
        return this.passthrough(src, at);
      }
    }
    return null;
  }

  // ── code block → joined markup ────────────────────────────────
  evalCode(src: string): string {
    let out = "";
    let i = 0;
    while (i < src.length) {
      while (i < src.length && WS.test(src[i])) {
        i++;
      }
      if (i >= src.length) {
        break;
      }
      if (src.startsWith("//", i)) {
        const nl = src.indexOf("\n", i);
        i = nl === -1 ? src.length : nl;
        continue;
      }
      if (src.startsWith("let ", i)) {
        i = this.declareLet(src, i + 4);
        continue;
      }
      if (src.startsWith("for ", i)) {
        const r = this.forLoop(src, i);
        out += r.text;
        i = r.next;
        continue;
      }
      const p = new P(src.slice(i));
      const node = p.parse();
      if (p.i === 0) {
        i++;
        continue;
      }
      i += p.i;
      out += this.toMarkup(this.evalNode(node));
    }
    return out;
  }

  forLoop(src: string, at: number): { text: string; next: number } {
    let i = at + 4;
    while (i < src.length && WS.test(src[i])) {
      i++;
    }
    const vars: string[] = [];
    if (src[i] === "(") {
      const end = src.indexOf(")", i);
      for (const part of src.slice(i + 1, end).split(",")) {
        vars.push(part.trim());
      }
      i = end + 1;
    } else {
      const p = new P(src.slice(i));
      vars.push(p.ident());
      i += p.i;
    }
    while (i < src.length && WS.test(src[i])) {
      i++;
    }
    if (src.startsWith("in ", i)) {
      i += 3;
    }
    const ip = new P(src.slice(i));
    const iterNode = ip.parse();
    i += ip.i;
    while (i < src.length && WS.test(src[i])) {
      i++;
    }
    const open = src[i];
    const bp = new P(src.slice(i));
    let body = "";
    if (open === "{") {
      body = bp.delim("{", "}");
    } else if (open === "[") {
      body = bp.delim("[", "]");
    }
    const next = i + bp.i;
    const bodyIsCode = open === "{";
    const enumerated = iterNode.t === "method" && iterNode.name === "enumerate";
    const arrNode = enumerated
      ? (iterNode as Node & { t: "method" }).target
      : iterNode;
    const arr = this.evalNode(arrNode);
    if (arr.k !== "arr") {
      return { text: "", next };
    }
    const saved = this.scope;
    let out = "";
    arr.items.forEach((item, idx) => {
      const local = new Map(saved);
      if (enumerated && vars.length === 2) {
        local.set(vars[0], { k: "num", n: idx });
        local.set(vars[1], item);
      } else {
        local.set(vars[0], item);
      }
      this.scope = local;
      out += bodyIsCode ? this.evalCode(body) : this.evalMarkup(body);
    });
    this.scope = saved;
    return { text: out, next };
  }

  markupIf(src: string, at: number): { text: string; next: number } {
    let i = at + 4;
    const branches: { cond: Node | null; body: string; code: boolean }[] = [];
    const read = (k: number, hasCond: boolean) => {
      let j = k;
      let cond: Node | null = null;
      if (hasCond) {
        const cp = new P(src.slice(j));
        cond = cp.parse();
        j += cp.i;
      }
      while (j < src.length && WS.test(src[j])) {
        j++;
      }
      const open = src[j];
      const bp = new P(src.slice(j));
      let body = "";
      if (open === "[") {
        body = bp.delim("[", "]");
      } else if (open === "{") {
        body = bp.delim("{", "}");
      }
      return { cond, body, end: j + bp.i, code: open === "{" };
    };
    let r = read(i, true);
    branches.push({ cond: r.cond, body: r.body, code: r.code });
    i = r.end;
    for (;;) {
      let k = i;
      while (k < src.length && WS.test(src[k])) {
        k++;
      }
      if (!src.startsWith("else", k)) {
        break;
      }
      k += 4;
      while (k < src.length && WS.test(src[k])) {
        k++;
      }
      if (src.startsWith("if ", k)) {
        r = read(k + 3, true);
        branches.push({ cond: r.cond, body: r.body, code: r.code });
        i = r.end;
      } else {
        r = read(k, false);
        branches.push({ cond: null, body: r.body, code: r.code });
        i = r.end;
        break;
      }
    }
    for (const b of branches) {
      if (b.cond === null || this.truthy(this.evalNode(b.cond))) {
        return {
          text: b.code ? this.evalCode(b.body) : this.evalMarkup(b.body),
          next: i,
        };
      }
    }
    return { text: "", next: i };
  }

  wrapper(src: string, at: number, fn: string): { text: string; next: number } {
    const hasParen = src[at + fn.length + 1] === "(";
    let j = at + fn.length + 1;
    let params = "";
    if (hasParen) {
      const pp = new P(src.slice(j));
      params = pp.delim("(", ")");
      j += pp.i;
    }
    while (j < src.length && SPACE_TAB.test(src[j])) {
      j++;
    }
    if (src[j] === "[") {
      const bp = new P(src.slice(j));
      const inner = bp.delim("[", "]");
      const end = j + bp.i;
      const head = hasParen ? `#${fn}(${params})` : `#${fn}`;
      return { text: `${head}[${this.evalMarkup(inner)}]`, next: end };
    }
    return { text: `#${fn}(${params})`, next: j };
  }

  grid(src: string, at: number): { text: string; next: number } {
    const p = new P(src.slice(at + 5));
    const inner = p.delim("(", ")");
    const end = at + 5 + p.i;
    const rebuilt: string[] = [];
    for (const part of this.splitTop(inner)) {
      const t = part.trim();
      if (!t) {
        continue;
      }
      // keep grid config args (columns:, column-gutter:, rows:, …) verbatim
      if (this.isNamedArg(t)) {
        rebuilt.push(t);
      } else {
        rebuilt.push(`[${this.cellMarkup(t)}]`);
      }
    }
    return { text: `#grid(${rebuilt.join(", ")})`, next: end };
  }

  // Split on top-level commas (paren/bracket/brace- and string-aware).
  splitTop(inner: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let start = 0;
    let i = 0;
    while (i < inner.length) {
      const ch = inner[i];
      if (ch === '"') {
        const sp = new P(inner.slice(i));
        sp.str();
        i += sp.i;
        continue;
      }
      if (ch === "(" || ch === "[" || ch === "{") {
        depth++;
      } else if (ch === ")" || ch === "]" || ch === "}") {
        depth--;
      } else if (ch === "," && depth === 0) {
        out.push(inner.slice(start, i));
        start = i + 1;
      }
      i++;
    }
    out.push(inner.slice(start));
    return out;
  }

  isNamedArg(t: string): boolean {
    const colon = t.indexOf(":");
    if (colon === -1) {
      return false;
    }
    return NAMED_ARG_RE.test(t.slice(0, colon).trim());
  }

  // A grid cell: `align(..)[BODY]`, `[BODY]`, or an expression → evaluated markup.
  cellMarkup(t: string): string {
    if (t.startsWith("[")) {
      return this.evalMarkup(new P(t).delim("[", "]"));
    }
    const call = CELL_CALL_RE.exec(t);
    const bracket = t.indexOf("[");
    if (call && bracket !== -1) {
      // wrapper call like align(top)[BODY] — render BODY (drop per-cell align)
      const body = new P(t.slice(bracket)).delim("[", "]");
      return this.evalMarkup(body);
    }
    return this.toMarkup(this.evalNode(new P(t).parse()));
  }

  passthrough(src: string, at: number): { text: string; next: number } {
    const m = IDENT_HEAD_RE.exec(src.slice(at));
    const ne = at + (m ? m[0].length : 1);
    const open = src[ne];
    if (open === "(" || open === "[") {
      const p = new P(src.slice(ne));
      p.delim(open, open === "(" ? ")" : "]");
      const e = ne + p.i;
      return { text: src.slice(at, e), next: e };
    }
    return { text: src.slice(at, ne), next: ne };
  }

  // `at` points just after "#let " / "let ".
  declareLet(src: string, at: number): number {
    const p = new P(src.slice(at));
    p.ws();
    const name = p.ident();
    p.ws();
    let params: Param[] | null = null;
    if (p.c() === "(") {
      params = this.parseParams(p);
    }
    p.ws();
    if (p.c() === "=") {
      p.i++;
    }
    p.ws();
    const { raw, end, openCh } = this.captureRhs(src, at + p.i);
    if (params) {
      const code = openCh === "{";
      const body = openCh === "{" || openCh === "[" ? raw.slice(1, -1) : raw;
      this.scope.set(name, { k: "fn", params, body, code });
      return end;
    }
    if (LET_LITERAL_RE.test(`let ${name} = ${raw}`)) {
      if (!(name in this.values)) {
        this.values[name] = this.literalToJs(raw);
      }
      return end;
    }
    this.scope.set(name, this.evalNode(new P(raw).parse()));
    return end;
  }

  literalToJs(raw: string): unknown {
    const t = raw.trim();
    if (t === "true") {
      return true;
    }
    if (t === "false") {
      return false;
    }
    if (t.startsWith('"')) {
      return t.slice(1, -1);
    }
    const num = Number(t);
    return Number.isNaN(num) ? t : num;
  }

  parseParams(p: P): Param[] {
    p.i++; // (
    const out: Param[] = [];
    for (;;) {
      p.ws();
      if (p.c() === ")" || p.i >= p.src.length) {
        p.i++;
        return out;
      }
      const name = p.ident();
      p.ws();
      let def: Node | undefined;
      if (p.c() === ":") {
        p.i++;
        def = p.parse();
      }
      out.push({ name, def });
      p.ws();
      if (p.c() === ",") {
        p.i++;
      }
    }
  }

  captureRhs(
    src: string,
    start: number
  ): { raw: string; end: number; openCh: string } {
    let j = start;
    while (j < src.length && SPACE_TAB.test(src[j])) {
      j++;
    }
    const first = src[j];
    if (first === "{" || first === "[" || first === "(") {
      const p = new P(src.slice(j));
      p.parse(); // consumes balanced group + postfix like `.filter(…)`
      // `parse()` skips trailing whitespace; trim it back so the captured raw
      // ends exactly at the closing delimiter (else slice(1,-1) eats a newline
      // instead of the closing bracket).
      let len = p.i;
      while (len > 0 && WS.test(src[j + len - 1])) {
        len--;
      }
      return { raw: src.slice(j, j + len), end: j + len, openCh: first };
    }
    const nl = src.indexOf("\n", j);
    const end = nl === -1 ? src.length : nl;
    return { raw: src.slice(j, end).trim(), end, openCh: "" };
  }
}

export function interpretNativeToMarkup(
  source: string,
  values: Record<string, unknown>
): string | null {
  try {
    const interp = new Interp({ ...values });
    return interp.evalMarkup(source);
  } catch {
    return null;
  }
}
