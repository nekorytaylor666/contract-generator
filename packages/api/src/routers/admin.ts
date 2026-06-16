import { randomUUID } from "node:crypto";
import { db } from "@contract-builder/db";
import { user } from "@contract-builder/db/schema/auth";
import { payment } from "@contract-builder/db/schema/payment";
import {
  subscriptionPlan,
  subscriptionUsage,
} from "@contract-builder/db/schema/subscription";
import { template } from "@contract-builder/db/schema/template";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, router } from "../index";
import { currentPeriodKey } from "../lib/subscription";

const paginationInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

const planInput = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  priceMonthly: z.number().int().min(0).default(0),
  priceYearly: z.number().int().min(0).nullable().optional(),
  discountLabel: z.string().nullable().optional(),
  // -1 = unlimited.
  downloadQuota: z.number().int().default(0),
  editQuota: z.number().int().default(0),
  features: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .default([]),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

// Keep at most one default plan.
async function clearOtherDefaults(keepId: string) {
  await db
    .update(subscriptionPlan)
    .set({ isDefault: false })
    .where(ne(subscriptionPlan.id, keepId));
}

export const adminRouter = router({
  // All registered users (admin oversight).
  users: adminProcedure.query(async () => {
    return await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isAdmin: user.isAdmin,
        accountType: user.accountType,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt));
  }),

  // All template purchases (who bought what, when, how much), paginated.
  purchases: adminProcedure.input(paginationInput).query(async ({ input }) => {
    const rows = await db
      .select({
        id: payment.id,
        createdAt: payment.createdAt,
        amount: payment.amount,
        status: payment.status,
        purpose: payment.purpose,
        userName: user.name,
        userEmail: user.email,
        templateTitle: template.title,
      })
      .from(payment)
      .leftJoin(user, eq(user.id, payment.userId))
      .leftJoin(template, eq(template.id, payment.templateId))
      .orderBy(desc(payment.createdAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
    const [{ total }] = await db.select({ total: count() }).from(payment);
    return { rows, total };
  }),

  // --- Subscription plans (CRUD) ---
  plans: adminProcedure.query(async () => {
    return await db
      .select()
      .from(subscriptionPlan)
      .orderBy(asc(subscriptionPlan.sortOrder));
  }),

  createPlan: adminProcedure.input(planInput).mutation(async ({ input }) => {
    const id = randomUUID();
    await db.insert(subscriptionPlan).values({ id, ...input });
    if (input.isDefault) {
      await clearOtherDefaults(id);
    }
    return { id };
  }),

  updatePlan: adminProcedure
    .input(z.object({ id: z.string() }).and(planInput.partial()))
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await db
        .update(subscriptionPlan)
        .set(patch)
        .where(eq(subscriptionPlan.id, id));
      if (patch.isDefault) {
        await clearOtherDefaults(id);
      }
      return { id };
    }),

  deletePlan: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db
        .delete(subscriptionPlan)
        .where(eq(subscriptionPlan.id, input.id));
      return { id: input.id };
    }),

  // --- User subscriptions (paginated) ---
  subscriptions: adminProcedure
    .input(paginationInput)
    .query(async ({ input }) => {
      const periodKey = currentPeriodKey();
      const rows = await db
        .select({
          userId: user.id,
          name: user.name,
          email: user.email,
          planId: user.subscriptionPlanId,
          planName: subscriptionPlan.name,
          period: user.subscriptionPeriod,
          expiresAt: user.subscriptionExpiresAt,
          downloadsUsed: subscriptionUsage.downloadsUsed,
          editsUsed: subscriptionUsage.editsUsed,
        })
        .from(user)
        .leftJoin(
          subscriptionPlan,
          eq(subscriptionPlan.id, user.subscriptionPlanId)
        )
        .leftJoin(
          subscriptionUsage,
          and(
            eq(subscriptionUsage.userId, user.id),
            eq(subscriptionUsage.periodKey, periodKey)
          )
        )
        .orderBy(desc(user.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      const [{ total }] = await db.select({ total: count() }).from(user);
      return { rows, total };
    }),

  setUserSubscription: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        planId: z.string().nullable(),
        period: z.enum(["monthly", "yearly"]).nullable().optional(),
        // ISO date string; null = no expiry.
        expiresAt: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [target] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, input.userId))
        .limit(1);
      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Пользователь не найден",
        });
      }
      await db
        .update(user)
        .set({
          subscriptionPlanId: input.planId,
          subscriptionPeriod: input.planId ? (input.period ?? "monthly") : null,
          subscriptionExpiresAt: input.expiresAt
            ? new Date(input.expiresAt)
            : null,
        })
        .where(eq(user.id, input.userId));
      return { userId: input.userId };
    }),
});
