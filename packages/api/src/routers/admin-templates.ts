import { randomUUID } from "node:crypto";
import { db } from "@contract-builder/db";
import {
  template,
  templateVersion,
} from "@contract-builder/db/schema/template";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, router } from "../index";
import { checkTypstCompiles } from "../lib/typst-compile-check";
import { buildPhotoTypstSource } from "./templates";

const variableSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["text", "textarea", "date", "number", "boolean", "select"]),
  label: z.string().min(1),
  hint: z.string().optional(),
  required: z.boolean(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z.array(z.string()).optional(),
  // Gray helper line under each radio-card option (from `// @label` markers).
  optionDescriptions: z.record(z.string(), z.string()).optional(),
  dependsOn: z
    .object({
      field: z.string(),
      // string / string[] for select/text deps, boolean for checkbox deps.
      value: z.union([z.string(), z.array(z.string()), z.boolean()]).optional(),
      operator: z.enum(["eq", "neq", "in"]).optional(),
    })
    .optional(),
  wordForms: z.tuple([z.string(), z.string(), z.string()]).optional(),
});

const upsertInput = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  price: z.number().int().min(0).default(0),
  downloadPrice: z.number().int().min(0).default(0),
  typstContent: z.string().min(1),
  variables: z.array(variableSchema).default([]),
  isPublished: z.boolean().default(false),
  // Full ancestor path slugs (group/subcategory/leaf) — see template-options.ts.
  categories: z.array(z.string()).default([]),
  documentType: z.string().nullable().optional(),
  // Per-locale overrides of title/description/typstContent (kk/ru/en),
  // plus that locale's own form variables when its typst differs.
  localizedContent: z
    .record(
      z.string(),
      z.object({
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        typstContent: z.string().optional(),
        variables: z.array(variableSchema).optional(),
      })
    )
    .default({}),
});

export interface CompileWarning {
  locale: string;
  error: string;
}

type VariableInput = z.infer<typeof variableSchema>;

function countLines(text: string): number {
  return text.split("\n").length;
}

// Runs every provided source (base + locale overrides) through the real Typst
// compiler. The in-app preview is a lenient interpreter, so this is the only
// signal an admin gets that a source the AI generated won't actually compile.
// Save still succeeds — the warnings ride along in the mutation response.
//
// Each source is compiled exactly as the photo/PDF pipeline will compile it
// (buildPhotoTypstSource), not raw — raw both false-alarms on legacy
// `#if {{flag}}` patterns and misses transform-induced failures. The line
// offset keeps reported line numbers matching the admin's editor (transforms
// substitute in place; only the style preamble can add lines).
async function collectCompileWarnings(
  typstContent: string | undefined,
  variables: VariableInput[],
  localizedContent:
    | Record<
        string,
        { typstContent?: string; variables?: VariableInput[] } | undefined
      >
    | undefined
): Promise<CompileWarning[]> {
  const sources: { locale: string; content: string; vars: VariableInput[] }[] =
    [];
  if (typstContent) {
    sources.push({ locale: "default", content: typstContent, vars: variables });
  }
  for (const [locale, entry] of Object.entries(localizedContent ?? {})) {
    if (entry?.typstContent) {
      sources.push({
        locale,
        content: entry.typstContent,
        // Same fallback the render path uses: a locale without its own synced
        // variable set inherits the default one.
        vars: entry.variables?.length ? entry.variables : variables,
      });
    }
  }
  const results = await Promise.all(
    sources.map(async ({ locale, content, vars }) => {
      const built = buildPhotoTypstSource(content, vars);
      const error = await checkTypstCompiles(built, {
        lineOffset: countLines(built) - countLines(content),
      });
      return error ? { locale, error } : null;
    })
  );
  return results.filter((w): w is CompileWarning => w !== null);
}

// The cached photo PNGs (served by /templates/:id/preview.png) are heavy
// base64 blobs — keep them out of admin JSON payloads.
function withoutPreviewImages<T extends { previewImages?: unknown }>(
  row: T
): Omit<T, "previewImages"> {
  const { previewImages: _previewImages, ...rest } = row;
  return rest;
}

async function snapshotVersion(
  templateRow: typeof template.$inferSelect,
  createdBy: string | null,
  changelog?: string
) {
  await db.insert(templateVersion).values({
    id: randomUUID(),
    templateId: templateRow.id,
    version: templateRow.currentVersion,
    typstContent: templateRow.typstContent,
    variables: templateRow.variables,
    changelog: changelog ?? null,
    createdBy,
  });
}

export const adminTemplatesRouter = router({
  list: adminProcedure.query(async () => {
    const rows = await db
      .select()
      .from(template)
      .orderBy(desc(template.updatedAt));
    return rows.map(withoutPreviewImages);
  }),

  create: adminProcedure.input(upsertInput).mutation(async ({ input, ctx }) => {
    const [created] = await db
      .insert(template)
      .values({
        id: randomUUID(),
        title: input.title,
        description: input.description ?? null,
        price: input.price,
        downloadPrice: input.downloadPrice,
        typstContent: input.typstContent,
        variables: input.variables,
        isPublished: input.isPublished,
        categories: input.categories,
        documentType: input.documentType ?? null,
        localizedContent: input.localizedContent,
        currentVersion: 1,
      })
      .returning();
    if (!created) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create template",
      });
    }
    await snapshotVersion(created, ctx.session.user.id);
    const compileWarnings = await collectCompileWarnings(
      input.typstContent,
      input.variables,
      input.localizedContent
    );
    return { ...withoutPreviewImages(created), compileWarnings };
  }),

  update: adminProcedure
    .input(z.object({ id: z.string() }).and(upsertInput.partial()))
    .mutation(async ({ input, ctx }) => {
      const { id, ...patch } = input;

      const [existing] = await db
        .select()
        .from(template)
        .where(eq(template.id, id))
        .limit(1);
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      // Bump version only when content/variables actually changed.
      // Other fields (title, description, price, isPublished) don't affect rendering.
      const contentChanged =
        (patch.typstContent !== undefined &&
          patch.typstContent !== existing.typstContent) ||
        (patch.variables !== undefined &&
          JSON.stringify(patch.variables) !==
            JSON.stringify(existing.variables));

      // Anything that changes the rendered document invalidates the cached
      // photo previews (regenerated lazily by /templates/:id/preview.png).
      const renderChanged =
        contentChanged ||
        (patch.localizedContent !== undefined &&
          JSON.stringify(patch.localizedContent) !==
            JSON.stringify(existing.localizedContent));

      const nextVersion = contentChanged
        ? existing.currentVersion + 1
        : existing.currentVersion;

      const [updated] = await db
        .update(template)
        .set({
          ...patch,
          currentVersion: nextVersion,
          ...(renderChanged ? { previewImages: {} } : {}),
        })
        .where(eq(template.id, id))
        .returning();

      if (contentChanged && updated) {
        await snapshotVersion(updated, ctx.session.user.id);
      }
      if (!updated) {
        return updated;
      }
      const compileWarnings = await collectCompileWarnings(
        patch.typstContent,
        patch.variables ?? ((existing.variables ?? []) as VariableInput[]),
        patch.localizedContent
      );
      return { ...withoutPreviewImages(updated), compileWarnings };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const [deleted] = await db
        .delete(template)
        .where(eq(template.id, input.id))
        .returning({ id: template.id });
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }
      return deleted;
    }),
});
