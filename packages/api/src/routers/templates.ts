import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { db } from "@contract-builder/db";
import { template } from "@contract-builder/db/schema/template";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../index";

const execAsync = promisify(exec);
const typstCompiler = NodeCompiler.create();
const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}/;
const DATA_URL_PREFIX_REGEX = /^data:image\/\w+;base64,/;

function formatValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value === "string" && DATE_ISO_REGEX.test(value)) {
    return value.split("T")[0];
  }
  return String(value);
}

function replaceVariables(
  typstContent: string,
  variables: Record<string, unknown>
): string {
  return typstContent.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return formatValue(variables[varName]) ?? match;
  });
}

interface TemplateVariable {
  name: string;
  type: "text" | "date" | "number" | "boolean" | "select";
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
      if (formatted === null) {
        return match;
      }

      if (!changedVars.has(varName) || booleanVars.has(varName)) {
        return formatted;
      }

      // Skip if inside a quoted string (used in #if conditions)
      const charBefore = offset > 0 ? typstContent[offset - 1] : "";
      const charAfter = typstContent[offset + match.length] ?? "";
      if (charBefore === '"' && charAfter === '"') {
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

  const parRule = `#set par(leading: ${preset.leading}, spacing: ${preset.spacing})`;
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
  list: publicProcedure.query(async () => {
    const templates = await db
      .select({
        id: template.id,
        title: template.title,
        description: template.description,
        price: template.price,
        variables: template.variables,
        isPublished: template.isPublished,
        createdAt: template.createdAt,
      })
      .from(template)
      .where(eq(template.isPublished, true));

    return templates;
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

  preview: publicProcedure
    .input(
      z.object({
        templateId: z.string(),
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
      const [found] = await db
        .select()
        .from(template)
        .where(eq(template.id, input.templateId))
        .limit(1);

      if (!found) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      const changedSet = new Set(input.changedVariables ?? []);
      const templateVars = (found.variables ?? []) as TemplateVariable[];

      const processedContent =
        changedSet.size > 0
          ? replaceVariablesWithHighlight(
              found.typstContent,
              input.variables,
              changedSet,
              templateVars
            )
          : replaceVariables(found.typstContent, input.variables);

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
      const [found] = await db
        .select()
        .from(template)
        .where(eq(template.id, input.templateId))
        .limit(1);

      if (!found) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      const processedContent = replaceVariables(
        found.typstContent,
        input.variables
      );

      try {
        const pdf = await compileTypst(processedContent, {
          logoBase64: input.logo,
          style: input.style,
        });
        const base64 = pdf.toString("base64");
        return {
          pdfDataUrl: `data:application/pdf;base64,${base64}`,
          fileName: `${found.title}.pdf`,
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
