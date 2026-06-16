import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { db } from "@contract-builder/db";
import { payment } from "@contract-builder/db/schema/payment";
import {
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
import { resolveLocalized } from "../constants/template-options";
import { protectedProcedure, publicProcedure, router } from "../index";
import { consumeQuota } from "../lib/subscription";
import { pluralize } from "../utils/pluralize";

const execAsync = promisify(exec);
const typstCompiler = NodeCompiler.create();
const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}/;
const DATA_URL_PREFIX_REGEX = /^data:image\/\w+;base64,/;

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

function replaceVariables(
  typstContent: string,
  variables: Record<string, unknown>
): string {
  return typstContent.replace(
    /\{\{(\w+)\}\}/g,
    (match, varName, offset: number) => {
      const formatted = formatValue(variables[varName]);
      if (formatted !== null) {
        return formatted;
      }

      // Don't style placeholders inside quoted strings (used in #if conditions)
      const charBefore = offset > 0 ? typstContent[offset - 1] : "";
      const charAfter = typstContent[offset + match.length] ?? "";
      if (charBefore === '"' && charAfter === '"') {
        return match;
      }

      return `#underline(offset: 2pt, stroke: 0.5pt + rgb("#9CA3AF"))[#text(fill: rgb("#9CA3AF"), size: 0.9em)[${varName}]]`;
    }
  );
}

interface TemplateVariable {
  name: string;
  type: "text" | "textarea" | "date" | "number" | "boolean" | "select";
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
    .query(async ({ input }) => {
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

      return found;
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
      const processedContent = replaceVariables(input.typstContent, vars);
      try {
        const vectorBuffer = await compileTypstToVector(processedContent, {
          logoBase64: input.logo,
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

      const processedContent =
        changedSet.size > 0
          ? replaceVariablesWithHighlight(
              source.typstContent,
              vars,
              changedSet,
              templateVars
            )
          : replaceVariables(source.typstContent, vars);

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
    .mutation(async ({ input }) => {
      const source = await loadTemplateSource(
        input.templateId,
        input.templateVersionId,
        input.locale
      );

      const templateVars = (source.variables ?? []) as TemplateVariable[];
      const vars = computeDerivedVariables(input.variables, templateVars);
      const processedContent = replaceVariables(source.typstContent, vars);

      try {
        const pdf = await compileTypst(processedContent, {
          logoBase64: input.logo,
          style: input.style,
        });
        const base64 = pdf.toString("base64");
        return {
          pdfDataUrl: `data:application/pdf;base64,${base64}`,
          fileName: `${source.title}.pdf`,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Failed to compile PDF: ${error.message}`
              : "Failed to compile PDF",
        });
      }
    }),

  /**
   * Download a finished copy of a template as PDF. Gated: requires a paid
   * "download" (or "edit") purchase unless the template's downloadPrice is 0.
   * Compiles the blank template (placeholders rendered as underlines, matching
   * the preview).
   */
  downloadPurchased: protectedProcedure
    .input(z.object({ templateId: z.string(), locale: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [tpl] = await db
        .select({
          title: template.title,
          description: template.description,
          typstContent: template.typstContent,
          localizedContent: template.localizedContent,
          downloadPrice: template.downloadPrice,
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
      const processedContent = replaceVariables(resolved.typstContent, {});
      try {
        const pdf = await compileTypst(processedContent);
        return {
          pdfDataUrl: `data:application/pdf;base64,${pdf.toString("base64")}`,
          fileName: `${resolved.title}.pdf`,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Failed to compile PDF: ${error.message}`
              : "Failed to compile PDF",
        });
      }
    }),
});

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
  if (templateVersionId) {
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

  const [live] = await db
    .select()
    .from(template)
    .where(eq(template.id, templateId))
    .limit(1);
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
    variables: live.variables,
  };
}
