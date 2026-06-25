import { randomUUID } from "node:crypto";
import { db } from "@contract-builder/db";
import { requisite } from "@contract-builder/db/schema/requisite";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { editorProcedure, orgProcedure, router } from "../index";

// Editable fields shared by create/update. Optional + defaulted so the client
// can send a partial payload; `name` is the only required field.
const requisiteFields = {
  name: z.string().trim().min(1, "Укажите наименование").max(200),
  type: z.string().trim().max(40).default("ТОО"),
  inn: z.string().trim().max(40).default(""),
  address: z.string().trim().max(500).default(""),
  phone: z.string().trim().max(60).default(""),
  email: z.string().trim().max(160).default(""),
  bank: z.string().trim().max(200).default(""),
  iban: z.string().trim().max(60).default(""),
  bik: z.string().trim().max(40).default(""),
  kbe: z.string().trim().max(20).default(""),
  knp: z.string().trim().max(20).default(""),
  signatory: z.string().trim().max(200).default(""),
  position: z.string().trim().max(200).default(""),
  basis: z.string().trim().max(200).default(""),
};

export const requisitesRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return await db
      .select()
      .from(requisite)
      .where(eq(requisite.organizationId, ctx.orgId))
      .orderBy(asc(requisite.createdAt));
  }),

  create: editorProcedure
    .input(z.object(requisiteFields))
    .mutation(async ({ ctx, input }) => {
      const id = randomUUID();
      await db
        .insert(requisite)
        .values({ id, organizationId: ctx.orgId, ...input });
      return { id };
    }),

  update: editorProcedure
    .input(z.object({ id: z.string(), ...requisiteFields }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const updated = await db
        .update(requisite)
        .set(fields)
        .where(
          and(eq(requisite.id, id), eq(requisite.organizationId, ctx.orgId))
        )
        .returning({ id: requisite.id });
      if (updated.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Реквизиты не найдены",
        });
      }
      return { id };
    }),

  delete: editorProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(requisite)
        .where(
          and(
            eq(requisite.id, input.id),
            eq(requisite.organizationId, ctx.orgId)
          )
        );
      return { success: true };
    }),
});
