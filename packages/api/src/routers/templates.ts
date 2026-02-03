import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { db } from "@contract-builder/db";
import { template } from "@contract-builder/db/schema/template";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../index";

const execAsync = promisify(exec);
const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}/;

function replaceVariables(
  typstContent: string,
  variables: Record<string, unknown>
): string {
  return typstContent.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = variables[varName];
    if (value === undefined || value === null) {
      return match;
    }
    if (value instanceof Date) {
      return value.toISOString().split("T")[0];
    }
    if (typeof value === "string" && DATE_ISO_REGEX.test(value)) {
      return value.split("T")[0];
    }
    return String(value);
  });
}

async function compileTypst(typstContent: string): Promise<Buffer> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `${id}.typ`);
  const outputPath = join(tmpdir(), `${id}.pdf`);

  try {
    await writeFile(inputPath, typstContent, "utf-8");
    await execAsync(`typst compile "${inputPath}" "${outputPath}"`);
    const pdf = await readFile(outputPath);
    return pdf;
  } finally {
    // Cleanup temp files, ignore errors if files don't exist
    await unlink(inputPath).catch(() => undefined);
    await unlink(outputPath).catch(() => undefined);
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

  compile: publicProcedure
    .input(
      z.object({
        templateId: z.string(),
        variables: z.record(z.string(), z.unknown()),
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
        const pdf = await compileTypst(processedContent);
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
