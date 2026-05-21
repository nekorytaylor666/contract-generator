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
  required: z.boolean(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z.array(z.string()).optional(),
  dependsOn: z
    .object({
      field: z.string(),
      value: z.union([z.string(), z.array(z.string())]).optional(),
      operator: z.enum(["eq", "neq", "in"]).optional(),
    })
    .optional(),
  wordForms: z.tuple([z.string(), z.string(), z.string()]).optional(),
});

const upsertInput = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  price: z.number().int().min(0).default(0),
  typstContent: z.string().min(1),
  variables: z.array(variableSchema).default([]),
  isPublished: z.boolean().default(false),
});

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
    return await db.select().from(template).orderBy(desc(template.updatedAt));
  }),

  create: adminProcedure.input(upsertInput).mutation(async ({ input, ctx }) => {
    const [created] = await db
      .insert(template)
      .values({
        id: randomUUID(),
        title: input.title,
        description: input.description ?? null,
        price: input.price,
        typstContent: input.typstContent,
        variables: input.variables,
        isPublished: input.isPublished,
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
    return created;
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

      const nextVersion = contentChanged
        ? existing.currentVersion + 1
        : existing.currentVersion;

      const [updated] = await db
        .update(template)
        .set({ ...patch, currentVersion: nextVersion })
        .where(eq(template.id, id))
        .returning();

      if (contentChanged && updated) {
        await snapshotVersion(updated, ctx.session.user.id);
      }
      return updated;
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
