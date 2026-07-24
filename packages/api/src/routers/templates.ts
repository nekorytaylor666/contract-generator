import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { db } from "@contract-builder/db";
import { member, user } from "@contract-builder/db/schema/auth";
import {
  document,
  documentVersion,
} from "@contract-builder/db/schema/document";
import { payment } from "@contract-builder/db/schema/payment";
import {
  type LocaleContent,
  template,
  templateBookmark,
  templateVersion,
} from "@contract-builder/db/schema/template";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { TRPCError } from "@trpc/server";
import {
  and,
  arrayOverlaps,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lte,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { canEditDocuments } from "../constants/access";
import {
  resolveLocalized,
  resolveLocalizedVariables,
} from "../constants/template-options";
import { protectedProcedure, publicProcedure, router } from "../index";
import {
  cloudflareDeliveryConfigured,
  cloudflareImagesConfigured,
  cloudflareImageUrl,
  deleteCloudflareImage,
  isCloudflareImageId,
  uploadCloudflareImage,
} from "../lib/cloudflare-images";
import {
  hasPaidEditPurchase,
  pinLatestTemplateVersion,
} from "../lib/document-service";
import { consumeQuota } from "../lib/subscription";
import { pluralize } from "../utils/pluralize";

const execAsync = promisify(exec);
const typstCompiler = NodeCompiler.create();
const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}/;
const DATA_URL_PREFIX_REGEX = /^data:image\/\w+;base64,/;

// How many leading blocks of a document to expose as a free teaser. Splitting on
// blank lines keeps blocks (paragraphs, grids) intact so the client typst parser
// still renders cleanly; the rest never leaves the server for unpaid users.
const PREVIEW_TEASER_BLOCKS = 6;
const BLANK_LINE_REGEX = /\n\s*\n/;

function truncateTypstForPreview(typst: string): string {
  if (!typst) {
    return typst;
  }
  const blocks = typst.split(BLANK_LINE_REGEX);
  if (blocks.length <= PREVIEW_TEASER_BLOCKS) {
    const keep = Math.max(1, Math.ceil(blocks.length / 2));
    return blocks.slice(0, keep).join("\n\n");
  }
  return blocks.slice(0, PREVIEW_TEASER_BLOCKS).join("\n\n");
}

function truncateLocalizedForPreview(
  localized: Record<string, LocaleContent>
): Record<string, LocaleContent> {
  const out: Record<string, LocaleContent> = {};
  for (const [locale, content] of Object.entries(localized)) {
    out[locale] =
      typeof content.typstContent === "string"
        ? {
            ...content,
            typstContent: truncateTypstForPreview(content.typstContent),
          }
        : content;
  }
  return out;
}

// Whether `userId` may see the full document (vs. a truncated teaser): free
// templates, anything they've purchased, or an active subscription.
async function canSeeFullTemplate(
  userId: string | undefined,
  tpl: { id: string; price: number }
): Promise<boolean> {
  if (tpl.price === 0) {
    return true;
  }
  if (!userId) {
    return false;
  }
  const [paid] = await db
    .select({ id: payment.id })
    .from(payment)
    .where(
      and(
        eq(payment.userId, userId),
        eq(payment.templateId, tpl.id),
        eq(payment.status, "paid")
      )
    )
    .limit(1);
  if (paid) {
    return true;
  }
  const [sub] = await db
    .select({
      isAdmin: user.isAdmin,
      planId: user.subscriptionPlanId,
      expiresAt: user.subscriptionExpiresAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (sub?.isAdmin) {
    return true;
  }
  return Boolean(sub?.planId && (!sub.expiresAt || sub.expiresAt > new Date()));
}

function formatValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && DATE_ISO_REGEX.test(value)) {
    return value.split("T")[0] ?? value;
  }
  return String(value);
}

const LET_NAME_REGEX = /^\w+$/;

// Formats a value for a native Typst `#let` binding: quoted string for text,
// raw literal for boolean/number. Empty/missing → null so the template keeps
// its own default (placeholder via #fill).
function formatLetValue(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(formatValue(value) ?? String(value));
}

// Native Typst templates declare fillable fields as top-level `#let name = ""`.
// Rewrites those bindings with the user's values — the #let analog of
// replaceVariables (which only substitutes {{var}} tokens). Only simple-literal
// bindings (string/bool/number) are touched, so functions/arrays/blocks are
// left intact.
function applyNativeLetValues(
  typstContent: string,
  values: Record<string, unknown>
): string {
  let result = typstContent;
  for (const [name, value] of Object.entries(values)) {
    if (!LET_NAME_REGEX.test(name)) {
      continue;
    }
    const formatted = formatLetValue(value);
    if (formatted === null) {
      continue;
    }
    const re = new RegExp(
      `(#let\\s+${name}\\s*=\\s*)("(?:[^"\\\\]|\\\\.)*"|true|false|-?\\d+(?:\\.\\d+)?)`,
      "g"
    );
    result = result.replace(re, (_match, prefix) => `${prefix}${formatted}`);
  }
  return result;
}

function defaultPlaceholder(varName: string): string {
  return `#underline(offset: 2pt, stroke: 0.5pt + rgb("#9CA3AF"))[#text(fill: rgb("#9CA3AF"), size: 0.9em)[${varName}]]`;
}

function replaceVariables(
  typstContent: string,
  variables: Record<string, unknown>,
  templateVars: TemplateVariable[] = [],
  renderPlaceholder: (varName: string) => string = defaultPlaceholder
): string {
  const booleanVars = new Set(
    templateVars.filter((v) => v.type === "boolean").map((v) => v.name)
  );

  return typstContent.replace(
    /\{\{(\w+)\}\}/g,
    (match, varName, offset: number) => {
      const formatted = formatValue(variables[varName]);

      // Booleans drive `#if {{var}}` (Typst code mode), so they must always
      // resolve to a literal true/false. The styled gray placeholder used for
      // unfilled fields is invalid in code position and breaks compilation
      // (e.g. on download where no values are supplied).
      if (booleanVars.has(varName)) {
        return formatted ?? "false";
      }

      if (formatted !== null) {
        return formatted;
      }

      // Don't style placeholders inside quoted strings (used in #if conditions)
      const charBefore = offset > 0 ? typstContent[offset - 1] : "";
      const charAfter = typstContent[offset + match.length] ?? "";
      if (charBefore === '"' && charAfter === '"') {
        return match;
      }

      return renderPlaceholder(varName);
    }
  );
}

export interface TemplateVariable {
  name: string;
  type: "text" | "textarea" | "date" | "number" | "boolean" | "select";
  label?: string;
  defaultValue?: string | number | boolean;
  options?: string[];
  wordForms?: [string, string, string];
}

function computeDerivedVariables(
  variables: Record<string, unknown>,
  templateVars: TemplateVariable[]
): Record<string, unknown> {
  const result = { ...variables };
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

function replaceVariablesWithHighlight(
  typstContent: string,
  variables: Record<string, unknown>,
  changedVars: Set<string>,
  templateVars: TemplateVariable[]
): string {
  const booleanVars = new Set(
    templateVars.filter((v) => v.type === "boolean").map((v) => v.name)
  );

  return typstContent.replace(
    /\{\{(\w+)\}\}/g,
    (match, varName, offset: number) => {
      const formatted = formatValue(variables[varName]);

      // Skip if inside a quoted string (used in #if conditions)
      const charBefore = offset > 0 ? typstContent[offset - 1] : "";
      const charAfter = typstContent[offset + match.length] ?? "";
      const insideQuotes = charBefore === '"' && charAfter === '"';

      if (formatted === null) {
        if (insideQuotes) {
          return match;
        }
        return `#underline(offset: 2pt, stroke: 0.5pt + rgb("#9CA3AF"))[#text(fill: rgb("#9CA3AF"), size: 0.9em)[${varName}]]`;
      }

      if (
        !changedVars.has(varName) ||
        booleanVars.has(varName) ||
        insideQuotes
      ) {
        return formatted;
      }

      const escaped = formatted.replace(/\]/g, "\\]");
      return `#highlight(fill: rgb("#FDE68A"))[${escaped}]`;
    }
  );
}

const STYLE_PRESETS: Record<
  string,
  { fontSize: string; margin: string; leading: string; spacing: string }
> = {
  compact: {
    fontSize: "9pt",
    margin: "1.5cm",
    leading: "0.55em",
    spacing: "0.6em",
  },
  default: {
    fontSize: "11pt",
    margin: "2cm",
    leading: "0.65em",
    spacing: "0.8em",
  },
  comfortable: {
    fontSize: "12pt",
    margin: "2.5cm",
    leading: "0.75em",
    spacing: "1em",
  },
  spacious: {
    fontSize: "13pt",
    margin: "3cm",
    leading: "0.85em",
    spacing: "1.2em",
  },
};

const SET_TEXT_REGEX = /#set text\([^)]*\)/;
const SET_TEXT_SIZE_REGEX = /#set text\(([^)]*)\bsize:\s*[\w.]+([^)]*)\)/;
const SET_PAGE_MARGIN_REGEX = /#set page\(margin:\s*[\w.]+\)/;
const SET_PAR_REGEX = /#set par\([^)]*\)/;

function applyStyleOverrides(
  typstContent: string,
  style?: { font?: string; preset?: string }
): string {
  if (!style) {
    return typstContent;
  }

  const presetKey = style.preset ?? "default";
  const preset = STYLE_PRESETS[presetKey] ?? STYLE_PRESETS.default;
  if (!preset) {
    return typstContent;
  }

  let result = typstContent;

  // Templates without their own `#set text(...)` (most AI-generated ones)
  // would otherwise compile with raw typst defaults — ragged right edge,
  // different margins — while the in-app preview renders the preset (justify
  // etc.). Prepend the preset instead: any `#set` rules the template does
  // declare come later and win, so this is a pure baseline.
  if (!result.includes("#set text(")) {
    const fontPart = style.font ? `font: "${style.font}", ` : "";
    const header = [
      `#set text(${fontPart}size: ${preset.fontSize})`,
      `#set page(margin: ${preset.margin})`,
      `#set par(leading: ${preset.leading}, spacing: ${preset.spacing}, justify: true)`,
    ].join("\n");
    return `${header}\n${result}`;
  }

  if (style.font) {
    result = result.replace(
      SET_TEXT_REGEX,
      `#set text(font: "${style.font}", size: ${preset.fontSize})`
    );
  } else {
    result = result.replace(
      SET_TEXT_SIZE_REGEX,
      `#set text($1size: ${preset.fontSize}$2)`
    );
  }

  result = result.replace(
    SET_PAGE_MARGIN_REGEX,
    `#set page(margin: ${preset.margin})`
  );

  const parRule = `#set par(leading: ${preset.leading}, spacing: ${preset.spacing}, justify: true)`;
  if (result.includes("#set par(")) {
    result = result.replace(SET_PAR_REGEX, parRule);
  } else {
    const textSetIdx = result.indexOf("#set text(");
    if (textSetIdx !== -1) {
      const lineEnd = result.indexOf("\n", textSetIdx);
      result = `${result.slice(0, lineEnd + 1)}${parRule}\n${result.slice(lineEnd + 1)}`;
    }
  }

  return result;
}

interface CompileOptions {
  logoBase64?: string;
  style?: { font?: string; preset?: string };
}

async function setupTempDir(
  id: string,
  typstContent: string,
  options?: CompileOptions
): Promise<{ inputPath: string; cleanupFiles: string[] }> {
  const inputPath = join(tmpdir(), `${id}.typ`);
  const filesToCleanup = [inputPath];
  let content = applyStyleOverrides(typstContent, options?.style);

  if (options?.logoBase64) {
    const logoPath = join(tmpdir(), `${id}-logo.png`);
    const base64Data = options.logoBase64.replace(DATA_URL_PREFIX_REGEX, "");
    await writeFile(logoPath, Buffer.from(base64Data, "base64"));
    filesToCleanup.push(logoPath);

    // Use relative filename since input .typ and logo are in the same directory
    const logoFilename = `${id}-logo.png`;
    const header = `#set page(header: align(right, image("${logoFilename}", height: 1.2cm)))`;
    const pageSetIdx = content.indexOf("#set page(");
    if (pageSetIdx !== -1) {
      const lineEnd = content.indexOf("\n", pageSetIdx);
      content = `${content.slice(0, lineEnd + 1)}${header}\n${content.slice(lineEnd + 1)}`;
    } else {
      content = `${header}\n${content}`;
    }
  }

  await writeFile(inputPath, content, "utf-8");
  return { inputPath, cleanupFiles: filesToCleanup };
}

async function cleanupFiles(files: string[]) {
  for (const f of files) {
    await unlink(f).catch(() => undefined);
  }
}

async function compileTypst(
  typstContent: string,
  options?: CompileOptions
): Promise<Buffer> {
  const id = randomUUID();
  const outputPath = join(tmpdir(), `${id}.pdf`);

  const { inputPath, cleanupFiles: files } = await setupTempDir(
    id,
    typstContent,
    options
  );
  files.push(outputPath);

  try {
    await execAsync(`typst compile "${inputPath}" "${outputPath}"`);
    return await readFile(outputPath);
  } finally {
    await cleanupFiles(files);
  }
}

// DOCX export: Typst → HTML (experimental HTML export) → Pandoc → DOCX. Page
// layout (margins, alignment, page header/logo) is dropped by HTML export; the
// document text/structure is preserved, which is what an editable .docx needs.
// Pandoc reference doc that styles the DOCX to resemble the PDF (Times New Roman
// 11pt, justified body, centered/black headings, A4 with 2cm margins). Falls
// back to pandoc defaults if the asset can't be resolved.
const REFERENCE_DOCX = (() => {
  try {
    return fileURLToPath(new URL("../assets/reference.docx", import.meta.url));
  } catch {
    return "";
  }
})();

// Drop document metadata (else pandoc emits a stray title heading from <title>).
const DOC_META_REGEX = /#set document\([^)]*\)\s*/g;
// Typst HTML export drops `#align`, losing the visible centered title. Convert
// the `#align(center)[#text(..., weight: "bold")[TITLE]]` pattern into a real
// heading (`= TITLE`) so it survives and we can style/center it via the
// reference doc (it becomes <h2> → Word "Heading 2").
const CENTERED_TITLE_REGEX =
  /#align\(center\)\[\s*#text\([^\]]*?weight:\s*"bold"[^\]]*?\)\[([^\]]*?)\]\s*\]/g;

function preprocessForDocx(typstContent: string): string {
  return typstContent
    .replace(DOC_META_REGEX, "")
    .replace(CENTERED_TITLE_REGEX, "= $1");
}

async function compileTypstToDocx(typstContent: string): Promise<Buffer> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `${id}.typ`);
  const htmlPath = join(tmpdir(), `${id}.html`);
  const docxPath = join(tmpdir(), `${id}.docx`);
  const files = [inputPath, htmlPath, docxPath];

  const refFlag =
    REFERENCE_DOCX && existsSync(REFERENCE_DOCX)
      ? `--reference-doc="${REFERENCE_DOCX}" `
      : "";

  try {
    await writeFile(inputPath, preprocessForDocx(typstContent), "utf-8");
    await execAsync(
      `typst compile --format html --features html "${inputPath}" "${htmlPath}"`
    );
    await execAsync(
      `pandoc "${htmlPath}" -f html -t docx ${refFlag}-o "${docxPath}"`
    );
    return await readFile(docxPath);
  } finally {
    await cleanupFiles(files);
  }
}

async function compileTypstToVector(
  typstContent: string,
  options?: CompileOptions
): Promise<Buffer> {
  let content = applyStyleOverrides(typstContent, options?.style);
  const filesToCleanup: string[] = [];

  try {
    if (options?.logoBase64) {
      const id = randomUUID();
      const logoPath = join(tmpdir(), `${id}-logo.png`);
      const base64Data = options.logoBase64.replace(DATA_URL_PREFIX_REGEX, "");
      await writeFile(logoPath, Buffer.from(base64Data, "base64"));
      filesToCleanup.push(logoPath);

      const header = `#set page(header: align(right, image("${logoPath}", height: 1.2cm)))`;
      const pageSetIdx = content.indexOf("#set page(");
      if (pageSetIdx !== -1) {
        const lineEnd = content.indexOf("\n", pageSetIdx);
        content = `${content.slice(0, lineEnd + 1)}${header}\n${content.slice(lineEnd + 1)}`;
      } else {
        content = `${header}\n${content}`;
      }
    }

    typstCompiler.evictCache(10);
    return typstCompiler.vector({ mainFileContent: content });
  } finally {
    await cleanupFiles(filesToCleanup);
  }
}

// --- Template "photo": a PNG of the rendered first page, shown as the
// --- catalogue/detail preview. Unfilled fields render as the variable's label
// --- in gray italic with a dashed underline (same look as the interactive
// --- preview), so the photo reads as a fillable document.

// 192 ppi ≈ 2x the on-screen size of the preview column — crisp on retina.
const PHOTO_PPI = 192;
const PHOTO_LOCALES = new Set(["ru", "kk", "en"]);
const TYPST_MARKUP_CHARS_REGEX = /[\\#[\]*_`$<>@]/g;

function escapeTypstMarkup(text: string): string {
  return text.replace(TYPST_MARKUP_CHARS_REGEX, (ch) => `\\${ch}`);
}

function photoPlaceholder(templateVars: TemplateVariable[]) {
  const labelByName = new Map(
    templateVars.map((v) => [v.name, v.label ?? v.name])
  );
  return (varName: string) => {
    const label = escapeTypstMarkup(labelByName.get(varName) ?? varName);
    return `#underline(offset: 2pt, stroke: (paint: rgb("#9CA3AF"), thickness: 0.5pt, dash: "dashed"))[#text(fill: rgb("#9CA3AF"), style: "italic", size: 0.9em)[${label}]]`;
  };
}

// Native templates render unfilled fields through their own `#let fill(...)`
// helper. For the photo, point each call's placeholder at the variable's label
// and restyle the canonical empty branch to the same gray dashed-underline
// look; templates with a custom fill body just keep their own placeholders.
const NATIVE_FILL_CALL_REGEX =
  /fill\(\s*(\w+)\s*(?:,\s*placeholder:\s*"[^"]*")?\s*\)/g;
const NATIVE_FILL_EMPTY_BRANCH = 'if value == "" [#placeholder] else [#value]';
const NATIVE_FILL_PHOTO_BRANCH =
  'if value == "" [#underline(offset: 2pt, stroke: (paint: rgb("#9CA3AF"), thickness: 0.5pt, dash: "dashed"))[#text(fill: rgb("#9CA3AF"), style: "italic", size: 0.9em)[#placeholder]]] else [#value]';

function styleNativeFillsForPhoto(
  typstContent: string,
  templateVars: TemplateVariable[],
  filledValues: Record<string, unknown>
): string {
  const labelByName = new Map(
    templateVars.map((v) => [v.name, v.label ?? v.name])
  );
  return typstContent
    .replace(NATIVE_FILL_CALL_REGEX, (match, name: string) => {
      const label = labelByName.get(name);
      if (!label || filledValues[name] !== undefined) {
        return match;
      }
      return `fill(${name}, placeholder: ${JSON.stringify(label)})`;
    })
    .replace(NATIVE_FILL_EMPTY_BRANCH, NATIVE_FILL_PHOTO_BRANCH);
}

// Fill structural fields (boolean/select + explicit defaults) so conditional
// branches render; leave the rest empty so the gray placeholder labels show.
function buildPhotoValues(
  templateVars: TemplateVariable[]
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const v of templateVars) {
    if (v.defaultValue !== undefined) {
      values[v.name] = v.defaultValue;
      continue;
    }
    if (v.type === "boolean") {
      values[v.name] = false;
    } else if (v.type === "select") {
      values[v.name] = v.options?.[0] ?? "";
    }
  }
  return values;
}

async function compileTypstToPng(typstContent: string): Promise<Buffer> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `${id}.typ`);
  const outputPath = join(tmpdir(), `${id}.png`);
  const files = [inputPath, outputPath];

  try {
    await writeFile(inputPath, typstContent, "utf-8");
    await execAsync(
      `typst compile --format png --pages 1 --ppi ${PHOTO_PPI} "${inputPath}" "${outputPath}"`
    );
    return await readFile(outputPath);
  } finally {
    await cleanupFiles(files);
  }
}

/**
 * Builds the exact Typst source the photo pipeline compiles: structural photo
 * values filled in, native `fill()` calls restyled, style preset applied.
 * Exported so the admin save validation checks the very source the photo/PDF
 * endpoints will run — validating the raw source instead gives false alarms
 * (e.g. legacy `#if {{flag}}` fails raw but compiles after substitution).
 */
export function buildPhotoTypstSource(
  typstContent: string,
  templateVars: TemplateVariable[]
): string {
  const values = buildPhotoValues(templateVars);
  const vars = computeDerivedVariables(values, templateVars);
  const substituted = replaceVariables(
    styleNativeFillsForPhoto(typstContent, templateVars, values),
    vars,
    templateVars,
    photoPlaceholder(templateVars)
  );
  return applyStyleOverrides(applyNativeLetValues(substituted, vars), {
    preset: "default",
  });
}

/** Compiles the photo PNG for one locale key; null when the source is broken. */
async function compileTemplatePhoto(
  row: typeof template.$inferSelect,
  key: string
): Promise<Buffer | null> {
  const resolved = resolveLocalized(
    {
      title: row.title,
      description: row.description,
      typstContent: row.typstContent,
    },
    row.localizedContent,
    key === "default" ? undefined : key
  );
  const templateVars = resolveLocalizedVariables(
    (row.variables ?? []) as TemplateVariable[],
    row.localizedContent,
    key === "default" ? undefined : key
  );
  const content = buildPhotoTypstSource(resolved.typstContent, templateVars);
  try {
    return await compileTypstToPng(content);
  } catch (error) {
    // The endpoint 404s and the client silently falls back to the in-browser
    // render, so without this log a broken template is invisible server-side.
    console.error(
      `preview.png: template ${row.id} (${key}) failed to compile:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Records one preview cache entry with an atomic jsonb merge, guarded by
 * updatedAt: a concurrent request for another locale must not be clobbered by
 * this row snapshot, and an admin edit mid-generation (which clears the cache
 * and deletes the Cloudflare images) must win over this now-stale write.
 * Setting updatedAt to its own unchanged value stops $onUpdate from bumping
 * it — caching a photo isn't a content edit, and the client's ?v=updatedAt
 * cache key must stay stable.
 */
async function savePreviewCacheEntry(
  row: typeof template.$inferSelect,
  key: string,
  value: string
): Promise<"stored" | "conflict"> {
  const [saved] = await db
    .update(template)
    .set({
      previewImages: sql`coalesce(${template.previewImages}, '{}'::jsonb) || ${JSON.stringify({ [key]: value })}::jsonb`,
      updatedAt: row.updatedAt,
    })
    .where(and(eq(template.id, row.id), eq(template.updatedAt, row.updatedAt)))
    .returning({ id: template.id });
  return saved ? "stored" : "conflict";
}

/**
 * Uploads a rendered photo to Cloudflare Images and records its id.
 * Returns null when the caller should fall back to serving the PNG bytes —
 * every failure path cleans up its own upload so images don't leak.
 */
async function storeCloudflarePreview(
  row: typeof template.$inferSelect,
  key: string,
  png: Buffer
): Promise<TemplatePreviewResult | null> {
  let imageId: string;
  try {
    imageId = await uploadCloudflareImage(png, {
      templateId: row.id,
      locale: key,
    });
  } catch (error) {
    console.error(
      `preview.png: template ${row.id} (${key}) Cloudflare upload failed:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
  try {
    const stored = await savePreviewCacheEntry(row, key, imageId);
    if (stored === "conflict") {
      // Admin edited the template mid-generation: their cache clear (and
      // image deletes) win — this render is stale, don't resurrect it.
      await deleteCloudflareImage(imageId);
      return null;
    }
    return { kind: "url", url: cloudflareImageUrl(imageId) };
  } catch (error) {
    console.error(
      `preview.png: template ${row.id} (${key}) failed to store preview cache:`,
      error instanceof Error ? error.message : error
    );
    await deleteCloudflareImage(imageId);
    return null;
  }
}

export type TemplatePreviewResult =
  | { kind: "url"; url: string }
  | { kind: "png"; png: Buffer };

async function generateTemplatePreview(
  templateId: string,
  locale?: string
): Promise<TemplatePreviewResult | null> {
  const [row] = await db
    .select()
    .from(template)
    .where(eq(template.id, templateId))
    .limit(1);
  if (!row) {
    return null;
  }

  const key = locale && PHOTO_LOCALES.has(locale) ? locale : "default";
  const cached = row.previewImages?.[key];
  // Note: a stored id with the account hash rotated out is deliberately NOT
  // served — it would redirect to imagedelivery.net/undefined/…; regeneration
  // below lands on the base64 path instead.
  if (cached && isCloudflareImageId(cached) && cloudflareDeliveryConfigured()) {
    return { kind: "url", url: cloudflareImageUrl(cached) };
  }
  const legacyPng =
    cached && !isCloudflareImageId(cached)
      ? Buffer.from(cached, "base64")
      : null;
  const uploadsReady = cloudflareImagesConfigured();
  if (legacyPng && !uploadsReady) {
    return { kind: "png", png: legacyPng };
  }

  // Reuse legacy cached bytes for the Cloudflare upgrade instead of
  // recompiling — with a broken token this path runs on every request and
  // must stay cheap (and keep serving the cache).
  const png = legacyPng ?? (await compileTemplatePhoto(row, key));
  if (!png) {
    return null;
  }

  if (uploadsReady) {
    const uploaded = await storeCloudflarePreview(row, key, png);
    if (uploaded) {
      return uploaded;
    }
    // Upload failed but a legacy cache entry exists — keep serving it without
    // rewriting the row; the upgrade retries on a later request.
    if (legacyPng) {
      return { kind: "png", png };
    }
  }

  try {
    await savePreviewCacheEntry(row, key, png.toString("base64"));
  } catch (error) {
    console.error(
      `preview.png: template ${templateId} (${key}) failed to store preview cache:`,
      error instanceof Error ? error.message : error
    );
  }
  return { kind: "png", png };
}

// One generation per (template, locale) at a time: concurrent catalogue views
// after an admin edit would otherwise each run a typst compile + upload and
// orphan each other's images.
const inflightPreviews = new Map<
  string,
  Promise<TemplatePreviewResult | null>
>();

/**
 * Photo of the template's first page for the given locale.
 *
 * With Cloudflare Images configured the PNG is uploaded there once and the
 * `preview_images` column stores just the image id — the endpoint redirects to
 * imagedelivery.net. Without it (or when the upload fails) the PNG is cached
 * base64-in-DB and served directly, exactly the old behavior. Legacy base64
 * cache entries are transparently re-uploaded (from the cached bytes, no
 * recompile) once Cloudflare is enabled.
 *
 * Returns null when the template is missing or its source fails to compile —
 * the client then falls back to the in-browser preview.
 */
export function getTemplatePreview(
  templateId: string,
  locale?: string
): Promise<TemplatePreviewResult | null> {
  const dedupeKey = `${templateId}:${locale ?? ""}`;
  const existing = inflightPreviews.get(dedupeKey);
  if (existing) {
    return existing;
  }
  const pending = generateTemplatePreview(templateId, locale).finally(() => {
    inflightPreviews.delete(dedupeKey);
  });
  inflightPreviews.set(dedupeKey, pending);
  return pending;
}

export const templatesRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          q: z.string().trim().max(200).optional(),
          // Document locale for localized title/description (kk/ru/en).
          locale: z.string().optional(),
          // Selected category slugs (any level: group/subcategory/leaf). A
          // template matches when its stored ancestor path overlaps this set.
          categories: z.array(z.string()).optional(),
          documentTypes: z.array(z.string()).optional(),
          industry: z.string().optional(),
          contractType: z.string().optional(),
          paymentTerm: z.string().optional(),
          participant: z.string().optional(),
          validityMaxSeconds: z.number().int().nonnegative().optional(),
          validityMinSeconds: z.number().int().nonnegative().optional(),
          validityIndefinite: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const conditions: SQL[] = [eq(template.isPublished, true)];

      const term = input?.q?.trim();
      if (term) {
        conditions.push(ilike(template.title, `%${term}%`));
      }
      if (input?.categories && input.categories.length > 0) {
        conditions.push(arrayOverlaps(template.categories, input.categories));
      }
      if (input?.documentTypes && input.documentTypes.length > 0) {
        conditions.push(inArray(template.documentType, input.documentTypes));
      }
      if (input?.industry) {
        conditions.push(sql`${input.industry} = ANY(${template.industries})`);
      }
      if (input?.contractType) {
        conditions.push(
          sql`${input.contractType} = ANY(${template.contractTypes})`
        );
      }
      if (input?.paymentTerm) {
        conditions.push(
          sql`${input.paymentTerm} = ANY(${template.paymentTerms})`
        );
      }
      if (input?.participant) {
        conditions.push(
          sql`${input.participant} = ANY(${template.participants})`
        );
      }
      if (input?.validityIndefinite) {
        conditions.push(isNull(template.validitySeconds));
      } else {
        if (input?.validityMaxSeconds != null) {
          conditions.push(
            lte(template.validitySeconds, input.validityMaxSeconds)
          );
        }
        if (input?.validityMinSeconds != null) {
          conditions.push(
            gt(template.validitySeconds, input.validityMinSeconds)
          );
        }
      }

      const templates = await db
        .select({
          id: template.id,
          title: template.title,
          description: template.description,
          localizedContent: template.localizedContent,
          price: template.price,
          variables: template.variables,
          isPublished: template.isPublished,
          categories: template.categories,
          documentType: template.documentType,
          industries: template.industries,
          contractTypes: template.contractTypes,
          paymentTerms: template.paymentTerms,
          participants: template.participants,
          validitySeconds: template.validitySeconds,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          // Popularity = number of paid purchases (drives the "popular" sort).
          purchaseCount: sql<number>`(
            SELECT COUNT(*)::int FROM ${payment}
            WHERE ${payment.templateId} = ${template.id}
              AND ${payment.status} = 'paid'
          )`,
        })
        .from(template)
        .where(and(...conditions));

      // Resolve localized title/description per locale; don't ship the heavy
      // localizedContent (full per-language bodies) to the client.
      return templates.map(({ localizedContent, ...rest }) => {
        const resolved = resolveLocalized(
          {
            title: rest.title,
            description: rest.description,
            typstContent: "",
          },
          localizedContent,
          input?.locale
        );
        return {
          ...rest,
          title: resolved.title,
          description: resolved.description,
        };
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [found] = await db
        .select()
        .from(template)
        .where(eq(template.id, input.id))
        .limit(1);

      if (!found) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      // The cached photo PNGs are served by /templates/:id/preview.png —
      // don't ship the heavy base64 blobs in the JSON payload.
      const { previewImages: _previewImages, ...rest } = found;

      // Paywall: unpaid users only get a truncated teaser. The full document
      // text never reaches the client, so a CSS un-blur reveals nothing extra.
      const fullAccess = await canSeeFullTemplate(ctx.session?.user.id, found);
      if (fullAccess) {
        return { ...rest, previewLimited: false };
      }
      return {
        ...rest,
        typstContent: truncateTypstForPreview(found.typstContent),
        localizedContent: truncateLocalizedForPreview(found.localizedContent),
        previewLimited: true,
      };
    }),

  // Template ids the current user has bookmarked ("сохранёнки").
  myBookmarks: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({ templateId: templateBookmark.templateId })
      .from(templateBookmark)
      .where(eq(templateBookmark.userId, ctx.session.user.id));
    return rows.map((row) => row.templateId);
  }),

  // Add/remove a template from the user's saved list. Returns the new state.
  toggleBookmark: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [existing] = await db
        .select({ id: templateBookmark.id })
        .from(templateBookmark)
        .where(
          and(
            eq(templateBookmark.userId, userId),
            eq(templateBookmark.templateId, input.templateId)
          )
        )
        .limit(1);
      if (existing) {
        await db
          .delete(templateBookmark)
          .where(eq(templateBookmark.id, existing.id));
        return { saved: false };
      }
      await db.insert(templateBookmark).values({
        id: randomUUID(),
        userId,
        templateId: input.templateId,
      });
      return { saved: true };
    }),

  /**
   * Render a draft template that hasn't been saved yet (used by admin builder).
   * Takes raw typstContent + variables[] + sample values directly.
   */
  previewDraft: publicProcedure
    .input(
      z.object({
        typstContent: z.string(),
        variables: z.array(z.unknown()).default([]),
        values: z.record(z.string(), z.unknown()).default({}),
        logo: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const templateVars = input.variables as TemplateVariable[];
      const vars = computeDerivedVariables(input.values, templateVars);
      const processedContent = applyNativeLetValues(
        replaceVariables(input.typstContent, vars, templateVars),
        vars
      );
      try {
        const vectorBuffer = await compileTypstToVector(processedContent, {
          logoBase64: input.logo,
          // Baseline preset so set-less templates render justified — same
          // look as the preview photo and the downloaded PDF.
          style: { preset: "default" },
        });
        return { vectorData: vectorBuffer.toString("base64") };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Failed to compile preview: ${error.message}`
              : "Failed to compile preview",
        });
      }
    }),

  preview: publicProcedure
    .input(
      z.object({
        templateId: z.string(),
        templateVersionId: z.string().optional(),
        locale: z.string().optional(),
        variables: z.record(z.string(), z.unknown()),
        changedVariables: z.array(z.string()).optional(),
        logo: z.string().optional(),
        style: z
          .object({
            font: z.string().optional(),
            preset: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const source = await loadTemplateSource(
        input.templateId,
        input.templateVersionId,
        input.locale
      );

      const changedSet = new Set(input.changedVariables ?? []);
      const templateVars = (source.variables ?? []) as TemplateVariable[];
      const vars = computeDerivedVariables(input.variables, templateVars);

      const substituted =
        changedSet.size > 0
          ? replaceVariablesWithHighlight(
              source.typstContent,
              vars,
              changedSet,
              templateVars
            )
          : replaceVariables(source.typstContent, vars, templateVars);
      const processedContent = applyNativeLetValues(substituted, vars);

      try {
        const vectorBuffer = await compileTypstToVector(processedContent, {
          logoBase64: input.logo,
          style: input.style,
        });
        return { vectorData: vectorBuffer.toString("base64") };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Failed to compile preview: ${error.message}`
              : "Failed to compile preview",
        });
      }
    }),

  compile: publicProcedure
    .input(
      z.object({
        templateId: z.string(),
        templateVersionId: z.string().optional(),
        // Сохранённый документ, который скачивают: первое скачивание
        // фиксирует присланные значения как финальную версию и закрывает
        // документ; повторные печатают только сохранённое состояние.
        documentId: z.string().optional(),
        locale: z.string().optional(),
        variables: z.record(z.string(), z.unknown()),
        logo: z.string().optional(),
        style: z
          .object({
            font: z.string().optional(),
            preset: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const download = input.documentId
        ? await prepareDocumentDownload(
            input.documentId,
            input.templateId,
            ctx.session
          )
        : ({ mode: "plain" } as const);

      // Скачанный («выданный») документ печатаем строго из сохранённого
      // состояния — присланные с клиента значения игнорируются, иначе одну
      // покупку можно было бы бесконечно переделывать под новые договоры.
      const compileArgs =
        download.mode === "locked"
          ? {
              templateId: download.doc.templateId,
              templateVersionId: download.doc.templateVersionId ?? undefined,
              variables: download.doc.variables as Record<string, unknown>,
              logo: download.doc.logo ?? undefined,
              style: (download.doc.style ?? undefined) as
                | { font?: string; preset?: string }
                | undefined,
            }
          : {
              templateId: input.templateId,
              templateVersionId: input.templateVersionId,
              variables: input.variables,
              logo: input.logo,
              style: input.style,
            };

      const source = await loadTemplateSource(
        compileArgs.templateId,
        compileArgs.templateVersionId,
        input.locale
      );

      const templateVars = (source.variables ?? []) as TemplateVariable[];
      const vars = computeDerivedVariables(compileArgs.variables, templateVars);
      const processedContent = applyNativeLetValues(
        replaceVariables(source.typstContent, vars, templateVars),
        vars
      );

      let pdf: Buffer;
      try {
        pdf = await compileTypst(processedContent, {
          logoBase64: compileArgs.logo,
          style: compileArgs.style,
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Failed to compile PDF: ${error.message}`
              : "Failed to compile PDF",
        });
      }
      // Первое скачивание фиксируем на сервере, а не с клиента: вкладку могут
      // закрыть или обновить раньше, чем ушла бы отдельная отметка.
      if (download.mode === "issue") {
        await issueDocumentDownload(download, compileArgs);
      }
      return {
        pdfDataUrl: `data:application/pdf;base64,${pdf.toString("base64")}`,
        fileName: `${source.title}.pdf`,
      };
    }),

  /**
   * Download a finished copy of a template as PDF. Gated: requires a paid
   * "download" (or "edit") purchase unless the template's downloadPrice is 0.
   * Compiles the blank template (placeholders rendered as underlines, matching
   * the preview).
   */
  downloadPurchased: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        locale: z.string().optional(),
        format: z.enum(["pdf", "docx"]).default("pdf"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [tpl] = await db
        .select({
          title: template.title,
          description: template.description,
          typstContent: template.typstContent,
          localizedContent: template.localizedContent,
          downloadPrice: template.downloadPrice,
          variables: template.variables,
        })
        .from(template)
        .where(eq(template.id, input.templateId))
        .limit(1);
      if (!tpl) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Шаблон не найден" });
      }

      if (tpl.downloadPrice > 0) {
        const [paid] = await db
          .select({ id: payment.id })
          .from(payment)
          .where(
            and(
              eq(payment.userId, ctx.session.user.id),
              eq(payment.templateId, input.templateId),
              eq(payment.status, "paid"),
              inArray(payment.purpose, [
                "template_download",
                "template_edit",
                "template_purchase",
              ])
            )
          )
          .limit(1);
        // Not purchased one-off — try the user's subscription download quota.
        if (!paid) {
          const quota = await consumeQuota(ctx.session.user.id, "download");
          if (!quota.allowed) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Шаблон не оплачен и лимит скачиваний исчерпан",
            });
          }
        }
      }

      const resolved = resolveLocalized(
        {
          title: tpl.title,
          description: tpl.description,
          typstContent: tpl.typstContent,
        },
        tpl.localizedContent,
        input.locale
      );
      const processedContent = replaceVariables(
        resolved.typstContent,
        {},
        resolveLocalizedVariables(
          (tpl.variables ?? []) as TemplateVariable[],
          tpl.localizedContent,
          input.locale
        )
      );
      try {
        if (input.format === "docx") {
          const docx = await compileTypstToDocx(processedContent);
          return {
            dataUrl: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docx.toString("base64")}`,
            fileName: `${resolved.title}.docx`,
          };
        }
        // Same baseline preset the preview photo uses — a set-less template
        // must download looking like its catalogue photo (justified, 2cm).
        const pdf = await compileTypst(processedContent, {
          style: { preset: "default" },
        });
        return {
          dataUrl: `data:application/pdf;base64,${pdf.toString("base64")}`,
          fileName: `${resolved.title}.pdf`,
        };
      } catch (error) {
        const fmt = input.format.toUpperCase();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Failed to compile ${fmt}: ${error.message}`
              : `Failed to compile ${fmt}`,
        });
      }
    }),
});

type DocumentDownload =
  /** Обычная компиляция шаблона — документ не затрагивается. */
  | { mode: "plain" }
  /** Документ уже «выдан»: печатаем только его сохранённое состояние. */
  | { mode: "locked"; doc: typeof document.$inferSelect }
  /** Первое скачивание: после компиляции фиксируем версию и ставим отметку. */
  | {
      mode: "issue";
      doc: typeof document.$inferSelect;
      tmpl: typeof template.$inferSelect;
      userId: string;
    };

/**
 * Решает, как обращаться с documentId при скачивании. Чужой или битый
 * documentId молча превращается в обычную компиляцию: заблокировать (или
 * прочитать) чужой договор нельзя, а честный клиент шлёт только свой id.
 */
async function prepareDocumentDownload(
  documentId: string,
  templateId: string,
  session: { user: { id: string } } | null | undefined
): Promise<DocumentDownload> {
  if (!session) {
    // Без сессии PDF ушёл бы без отметки «скачан» — блокировка молча снялась
    // бы. Честный клиент шлёт documentId только из авторизованного билдера.
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Сессия истекла — войдите и повторите скачивание",
    });
  }
  const [doc] = await db
    .select()
    .from(document)
    .where(eq(document.id, documentId))
    .limit(1);
  if (!doc) {
    return { mode: "plain" };
  }
  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.userId, session.user.id),
        eq(member.organizationId, doc.organizationId)
      )
    )
    .limit(1);
  if (!membership) {
    return { mode: "plain" };
  }
  if (doc.downloadedAt) {
    return { mode: "locked", doc };
  }
  // Шаблон в запросе обязан совпадать с шаблоном документа, а «выдать»
  // договор может только роль с правом редактирования — просмотрщик скачивает
  // без последствий для документа.
  if (doc.templateId !== templateId || !canEditDocuments(membership.role)) {
    return { mode: "plain" };
  }
  // Купленное редактирование шаблона не «выдаётся»: скачивание — просто
  // печать текущего состояния, документ остаётся редактируемым. Блокировка
  // нужна только скачиванию без права редактирования, чтобы одну выдачу не
  // переделывали бесконечно. Проверяем и скачивающего, и автора документа —
  // документ мог быть создан по покупке коллеги.
  const editPurchased =
    (await hasPaidEditPurchase(session.user.id, doc.templateId)) ||
    (doc.createdBy !== session.user.id &&
      (await hasPaidEditPurchase(doc.createdBy, doc.templateId)));
  if (editPurchased) {
    return { mode: "plain" };
  }
  const [tmpl] = await db
    .select()
    .from(template)
    .where(eq(template.id, doc.templateId))
    .limit(1);
  if (!tmpl) {
    return { mode: "plain" };
  }
  return { mode: "issue", doc, tmpl, userId: session.user.id };
}

/**
 * Первое скачивание: скачанные значения становятся финальной версией
 * документа (иначе выданный PDF разошёлся бы с сохранённым состоянием), и
 * документ закрывается для правок. Всё под блокировкой строки — параллельное
 * скачивание или сохранение не перезапишет уже выданный договор.
 */
async function issueDocumentDownload(
  { doc, tmpl, userId }: Extract<DocumentDownload, { mode: "issue" }>,
  values: {
    variables: Record<string, unknown>;
    logo?: string;
    style?: { font?: string; preset?: string };
  }
) {
  const pinnedVersionId = await pinLatestTemplateVersion(db, tmpl, userId);
  await db.transaction(async (tx) => {
    const [fresh] = await tx
      .select({
        id: document.id,
        currentVersion: document.currentVersion,
        downloadedAt: document.downloadedAt,
      })
      .from(document)
      .where(eq(document.id, doc.id))
      .for("update")
      .limit(1);
    if (!fresh || fresh.downloadedAt) {
      return;
    }
    const newVersion = fresh.currentVersion + 1;
    await tx.insert(documentVersion).values({
      id: randomUUID(),
      documentId: fresh.id,
      version: newVersion,
      templateVersionId: pinnedVersionId,
      variables: values.variables,
      logo: values.logo ?? null,
      style: values.style ?? null,
      createdBy: userId,
    });
    await tx
      .update(document)
      .set({
        variables: values.variables,
        logo: values.logo ?? null,
        style: values.style ?? null,
        currentVersion: newVersion,
        templateVersionId: pinnedVersionId,
        downloadedAt: new Date(),
      })
      .where(eq(document.id, fresh.id));
  });
}

/**
 * Load template content + variables. If `templateVersionId` is provided, returns
 * the pinned snapshot (so old documents render with their original template).
 * Otherwise returns the live template (for previewing fresh templates).
 */
async function loadTemplateSource(
  templateId: string,
  templateVersionId?: string,
  locale?: string
): Promise<{ title: string; typstContent: string; variables: unknown }> {
  const [live] = await db
    .select()
    .from(template)
    .where(eq(template.id, templateId))
    .limit(1);

  // Localized overrides aren't versioned: when the requested locale has its
  // own typst, the form was built from the locale's variables, and only the
  // live localized source matches their literals — a default-language
  // snapshot would silently fail every `#if` comparison.
  const hasLocaleOverride = Boolean(
    locale && live?.localizedContent?.[locale]?.typstContent
  );

  if (templateVersionId && !hasLocaleOverride) {
    const [version] = await db
      .select({
        typstContent: templateVersion.typstContent,
        variables: templateVersion.variables,
        title: template.title,
      })
      .from(templateVersion)
      .innerJoin(template, eq(template.id, templateVersion.templateId))
      .where(eq(templateVersion.id, templateVersionId))
      .limit(1);
    if (version) {
      return version;
    }
    // Pinned version was deleted somehow — fall through to live template.
  }

  if (!live) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Template not found",
    });
  }
  const resolved = resolveLocalized(
    {
      title: live.title,
      description: live.description,
      typstContent: live.typstContent,
    },
    live.localizedContent,
    locale
  );
  return {
    title: resolved.title,
    typstContent: resolved.typstContent,
    // Variables must match the locale's typst (wordForms, date fields, and
    // option literals differ per language).
    variables: resolveLocalizedVariables(
      Array.isArray(live.variables) ? live.variables : [],
      live.localizedContent,
      locale
    ),
  };
}
