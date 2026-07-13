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
    return withoutPreviewImages(created);
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
      return updated ? withoutPreviewImages(updated) : updated;
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
