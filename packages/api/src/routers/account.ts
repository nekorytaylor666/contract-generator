import { db } from "@contract-builder/db";
import { user } from "@contract-builder/db/schema/auth";
import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";

export const accountRouter = router({
  // The current user's editable profile fields.
  me: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        image: user.image,
        contractLanguage: user.contractLanguage,
      })
      .from(user)
      .where(eq(user.id, ctx.session.user.id))
      .limit(1);
    return row ?? null;
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120).optional(),
        // null clears the value; omitted leaves it unchanged.
        email: z.string().trim().toLowerCase().email().nullable().optional(),
        phoneNumber: z.string().trim().min(5).max(20).nullable().optional(),
        contractLanguage: z.enum(["ru", "kk", "en"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (input.email) {
        const [taken] = await db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.email, input.email), ne(user.id, userId)))
          .limit(1);
        if (taken) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Эта почта уже используется",
          });
        }
      }
      if (input.phoneNumber) {
        const [taken] = await db
          .select({ id: user.id })
          .from(user)
          .where(
            and(eq(user.phoneNumber, input.phoneNumber), ne(user.id, userId))
          )
          .limit(1);
        if (taken) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Этот номер уже используется",
          });
        }
      }

      const updates: Partial<typeof user.$inferInsert> = {};
      if (input.name !== undefined) {
        updates.name = input.name;
      }
      if (input.email !== undefined) {
        updates.email = input.email;
      }
      if (input.phoneNumber !== undefined) {
        updates.phoneNumber = input.phoneNumber;
      }
      if (input.contractLanguage !== undefined) {
        updates.contractLanguage = input.contractLanguage;
      }

      if (Object.keys(updates).length > 0) {
        await db.update(user).set(updates).where(eq(user.id, userId));
      }
      return { success: true };
    }),
});
