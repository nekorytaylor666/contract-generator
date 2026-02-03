import { db } from "@contract-builder/db";
import { template } from "@contract-builder/db/schema/template";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../index";

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
});
