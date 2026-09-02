import { db } from "@contract-builder/db";
import { user } from "@contract-builder/db/schema/auth";
import { subscriptionPlan } from "@contract-builder/db/schema/subscription";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";

import { protectedProcedure, publicProcedure, router } from "../index";
import {
  currentPeriodKey,
  getEffectivePlan,
  getUsage,
} from "../lib/subscription";

function remaining(quota: number, used: number): number {
  return quota === -1 ? -1 : Math.max(0, quota - used);
}

const QUARTER_MONTHS = 3;
const YEAR_MONTHS = 12;

// Цена тарифа за выбранный период; квартал/год без явной цены — кратно
// месячной (зеркалит логику чекаута и карточек планов).
function priceForPeriod(
  plan: {
    priceMonthly: number;
    priceQuarterly: number | null;
    priceYearly: number | null;
  },
  period: string | null
): number {
  if (period === "yearly") {
    return plan.priceYearly ?? plan.priceMonthly * YEAR_MONTHS;
  }
  if (period === "quarterly") {
    return plan.priceQuarterly ?? plan.priceMonthly * QUARTER_MONTHS;
  }
  return plan.priceMonthly;
}

export const subscriptionsRouter = router({
  // Active plans for the profile page.
  plans: protectedProcedure.query(async () => {
    return await db
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.isActive, true))
      .orderBy(asc(subscriptionPlan.sortOrder));
  }),

  // Публичная витрина тарифов для страницы /plans на сайте: только карточные
  // поля, без служебных флагов (isDefault и т.п.).
  plansPublic: publicProcedure.query(async () => {
    return await db
      .select({
        id: subscriptionPlan.id,
        name: subscriptionPlan.name,
        description: subscriptionPlan.description,
        priceMonthly: subscriptionPlan.priceMonthly,
        priceQuarterly: subscriptionPlan.priceQuarterly,
        priceYearly: subscriptionPlan.priceYearly,
        discountLabel: subscriptionPlan.discountLabel,
        downloadQuota: subscriptionPlan.downloadQuota,
        editQuota: subscriptionPlan.editQuota,
        features: subscriptionPlan.features,
      })
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.isActive, true))
      .orderBy(asc(subscriptionPlan.sortOrder));
  }),

  // The current user's effective plan + remaining monthly quotas.
  mySubscription: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const plan = await getEffectivePlan(userId);
    const usage = await getUsage(userId, currentPeriodKey());
    const [row] = await db
      .select({
        expiresAt: user.subscriptionExpiresAt,
        period: user.subscriptionPeriod,
        cancelledAt: user.subscriptionCancelledAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const isPaid = Boolean(plan && !plan.isDefault);
    return {
      planId: plan?.id ?? null,
      planName: plan?.name ?? null,
      // Платная подписка (не дефолтный «Разовый» тариф) — открывает смену
      // статусов документов.
      isPaid,
      // Истёкшая подписка лениво откатывается на дефолтный план — сырые даты
      // при этом не отдаём, иначе профиль показывал бы «активна до <прошлое>».
      expiresAt: isPaid ? (row?.expiresAt ?? null) : null,
      period: isPaid ? (row?.period ?? null) : null,
      cancelledAt: isPaid ? (row?.cancelledAt ?? null) : null,
      price: plan && isPaid ? priceForPeriod(plan, row?.period ?? null) : 0,
      downloadQuota: plan?.downloadQuota ?? 0,
      editQuota: plan?.editQuota ?? 0,
      reviewQuota: plan?.reviewQuota ?? 0,
      downloadsUsed: usage.downloadsUsed,
      editsUsed: usage.editsUsed,
      reviewsUsed: usage.reviewsUsed,
      downloadRemaining: plan
        ? remaining(plan.downloadQuota, usage.downloadsUsed)
        : 0,
      editRemaining: plan ? remaining(plan.editQuota, usage.editsUsed) : 0,
      reviewRemaining: plan
        ? remaining(plan.reviewQuota, usage.reviewsUsed)
        : 0,
    };
  }),

  // «Отменить подписку»: автосписаний нет, поэтому это пометка «не продлевать»
  // — доступ и квоты сохраняются до subscriptionExpiresAt.
  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const plan = await getEffectivePlan(userId);
    if (!plan || plan.isDefault) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Нет активной платной подписки",
      });
    }
    await db
      .update(user)
      .set({ subscriptionCancelledAt: new Date() })
      .where(eq(user.id, userId));
    return { success: true };
  }),

  // «Восстановить подписку» — снимает пометку отмены.
  restore: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(user)
      .set({ subscriptionCancelledAt: null })
      .where(eq(user.id, ctx.session.user.id));
    return { success: true };
  }),
});
