import { randomUUID } from "node:crypto";
import { db } from "@contract-builder/db";
import { payment } from "@contract-builder/db/schema/payment";
import { subscriptionPlan } from "@contract-builder/db/schema/subscription";
import { template } from "@contract-builder/db/schema/template";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import {
  buildInitPaymentUrl,
  formatOutSum,
  getRobokassaConfig,
} from "../lib/robokassa";

// Unpaid invoices expire after 6 hours instead of waiting indefinitely.
const PENDING_PAYMENT_TTL_MS = 6 * 60 * 60 * 1000;

// The account email to pre-fill on Robokassa (so it isn't asked again). Phone-
// only users have no real email (their placeholder ends with @phone.local) —
// returns undefined so Robokassa prompts the buyer for one.
function accountEmail(email: string | null | undefined): string | undefined {
  if (!email || email.endsWith("@phone.local")) {
    return undefined;
  }
  return email;
}

export const paymentsRouter = router({
  // Creates a pending payment for a paid template and returns the Robokassa
  // hosted-page URL the frontend should redirect to.
  createTemplateCheckout: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        // "edit" = buy access to the constructor; "download" = buy a finished
        // copy for download/view. Different prices, tracked separately.
        kind: z.enum(["edit", "download"]).default("edit"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate gateway config up-front (throws if not set up).
      const { isTest } = getRobokassaConfig();

      const [tpl] = await db
        .select({
          id: template.id,
          title: template.title,
          price: template.price,
          downloadPrice: template.downloadPrice,
        })
        .from(template)
        .where(eq(template.id, input.templateId))
        .limit(1);

      if (!tpl) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Шаблон не найден" });
      }

      const isDownload = input.kind === "download";
      const amount = isDownload ? tpl.downloadPrice : tpl.price;
      const purpose = isDownload ? "template_download" : "template_edit";
      if (amount <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Бесплатно — оплата не требуется",
        });
      }

      // Legacy purchases used "template_purchase" — count them as edit access.
      const matchingPurposes = isDownload
        ? ["template_download"]
        : ["template_edit", "template_purchase"];
      const [alreadyPaid] = await db
        .select({ id: payment.id })
        .from(payment)
        .where(
          and(
            eq(payment.userId, ctx.session.user.id),
            eq(payment.templateId, tpl.id),
            eq(payment.status, "paid"),
            inArray(payment.purpose, matchingPurposes)
          )
        )
        .limit(1);
      if (alreadyPaid) {
        return { alreadyPurchased: true as const };
      }

      const description = isDownload
        ? `Скачивание шаблона: ${tpl.title}`
        : `Покупка шаблона: ${tpl.title}`;
      const [created] = await db
        .insert(payment)
        .values({
          id: randomUUID(),
          userId: ctx.session.user.id,
          organizationId: ctx.session.session.activeOrganizationId ?? null,
          templateId: tpl.id,
          purpose,
          amount,
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
        outSum: formatOutSum(amount),
        invId: created.invId,
        description,
        email: accountEmail(ctx.session.user.email),
      });

      return { alreadyPurchased: false as const, url };
    }),

  // Start paying for a subscription plan via Robokassa. On a successful
  // ResultURL webhook the plan is activated for the user (see payment-service).
  createSubscriptionCheckout: protectedProcedure
    .input(
      z.object({
        planId: z.string().min(1),
        period: z.enum(["monthly", "quarterly", "yearly"]).default("monthly"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate gateway config up-front (throws if not set up).
      const { isTest } = getRobokassaConfig();

      const [plan] = await db
        .select({
          id: subscriptionPlan.id,
          name: subscriptionPlan.name,
          priceMonthly: subscriptionPlan.priceMonthly,
          priceQuarterly: subscriptionPlan.priceQuarterly,
          priceYearly: subscriptionPlan.priceYearly,
          isActive: subscriptionPlan.isActive,
        })
        .from(subscriptionPlan)
        .where(eq(subscriptionPlan.id, input.planId))
        .limit(1);

      if (!plan?.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Тариф не найден" });
      }

      let amount = plan.priceMonthly;
      let periodLabel = "месяц";
      if (input.period === "yearly") {
        amount = plan.priceYearly ?? plan.priceMonthly * 12;
        periodLabel = "год";
      } else if (input.period === "quarterly") {
        amount = plan.priceQuarterly ?? plan.priceMonthly * 3;
        periodLabel = "квартал";
      }
      if (amount <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Этот тариф бесплатный — оплата не требуется",
        });
      }

      const description = `Подписка: ${plan.name} (${periodLabel})`;
      const [created] = await db
        .insert(payment)
        .values({
          id: randomUUID(),
          userId: ctx.session.user.id,
          organizationId: ctx.session.session.activeOrganizationId ?? null,
          templateId: null,
          purpose: "subscription",
          subscriptionPlanId: plan.id,
          subscriptionPeriod: input.period,
          amount,
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
        outSum: formatOutSum(amount),
        invId: created.invId,
        description,
        email: accountEmail(ctx.session.user.email),
      });

      return { url };
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

  // What the current user has paid for, split by access kind — drives the
  // template popup's "Редактировать" / "Скачать" button states.
  myPurchases: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({ templateId: payment.templateId, purpose: payment.purpose })
      .from(payment)
      .where(
        and(eq(payment.userId, ctx.session.user.id), eq(payment.status, "paid"))
      );
    const purchases: { templateId: string; kind: "edit" | "download" }[] = [];
    for (const row of rows) {
      if (!row.templateId) {
        continue;
      }
      purchases.push({
        templateId: row.templateId,
        kind: row.purpose === "template_download" ? "download" : "edit",
      });
    }
    return purchases;
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
          purpose: payment.purpose,
          // Черновик, созданный вебхуком при оплате template_edit, — success-
          // страница открывает конструктор сразу на нём.
          documentId: payment.documentId,
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

  // Purchase history for the profile (subscriptions + template payments).
  myHistory: protectedProcedure.query(async ({ ctx }) => {
    // Pending invoices stop "waiting" after 6 hours — mark them expired so they
    // don't hang forever. A genuine late Robokassa confirmation still completes
    // them (processRobokassaResult also accepts the "expired" state).
    await db
      .update(payment)
      .set({ status: "expired" })
      .where(
        and(
          eq(payment.userId, ctx.session.user.id),
          eq(payment.status, "pending"),
          lt(payment.createdAt, new Date(Date.now() - PENDING_PAYMENT_TTL_MS))
        )
      );

    return await db
      .select({
        invId: payment.invId,
        description: payment.description,
        purpose: payment.purpose,
        amount: payment.amount,
        status: payment.status,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .where(eq(payment.userId, ctx.session.user.id))
      .orderBy(desc(payment.createdAt));
  }),
});
