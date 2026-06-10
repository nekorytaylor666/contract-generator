import { randomUUID } from "node:crypto";
import { db } from "@contract-builder/db";
import { payment } from "@contract-builder/db/schema/payment";
import { template } from "@contract-builder/db/schema/template";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import {
  buildInitPaymentUrl,
  formatOutSum,
  getRobokassaConfig,
} from "../lib/robokassa";

export const paymentsRouter = router({
  // Creates a pending payment for a paid template and returns the Robokassa
  // hosted-page URL the frontend should redirect to.
  createTemplateCheckout: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Validate gateway config up-front (throws if not set up).
      const { isTest } = getRobokassaConfig();

      const [tpl] = await db
        .select({
          id: template.id,
          title: template.title,
          price: template.price,
        })
        .from(template)
        .where(eq(template.id, input.templateId))
        .limit(1);

      if (!tpl) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Шаблон не найден" });
      }
      if (tpl.price <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Шаблон бесплатный — оплата не требуется",
        });
      }

      const [alreadyPaid] = await db
        .select({ id: payment.id })
        .from(payment)
        .where(
          and(
            eq(payment.userId, ctx.session.user.id),
            eq(payment.templateId, tpl.id),
            eq(payment.status, "paid")
          )
        )
        .limit(1);
      if (alreadyPaid) {
        return { alreadyPurchased: true as const };
      }

      const description = `Покупка шаблона: ${tpl.title}`;
      const [created] = await db
        .insert(payment)
        .values({
          id: randomUUID(),
          userId: ctx.session.user.id,
          organizationId: ctx.session.session.activeOrganizationId ?? null,
          templateId: tpl.id,
          purpose: "template_purchase",
          amount: tpl.price,
          status: "pending",
          isTest,
          description,
        })
        .returning({ invId: payment.invId });

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Не удалось создать платёж",
        });
      }

      const url = buildInitPaymentUrl({
        outSum: formatOutSum(tpl.price),
        invId: created.invId,
        description,
      });

      return { alreadyPurchased: false as const, url };
    }),

  // Template ids the current user has paid for (drives the "Куплено" UI state).
  myPurchasedTemplateIds: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({ templateId: payment.templateId })
      .from(payment)
      .where(
        and(eq(payment.userId, ctx.session.user.id), eq(payment.status, "paid"))
      );
    return rows
      .map((row) => row.templateId)
      .filter((id): id is string => id !== null);
  }),

  // Status lookup for the success page (polled until the webhook marks it paid).
  getByInvId: protectedProcedure
    .input(z.object({ invId: z.coerce.number().int() }))
    .query(async ({ ctx, input }) => {
      const [found] = await db
        .select({
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          templateId: payment.templateId,
        })
        .from(payment)
        .where(
          and(
            eq(payment.invId, input.invId),
            eq(payment.userId, ctx.session.user.id)
          )
        )
        .limit(1);
      if (!found) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Платёж не найден" });
      }
      return found;
    }),
});
