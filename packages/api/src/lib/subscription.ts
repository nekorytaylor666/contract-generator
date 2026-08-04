import { randomUUID } from "node:crypto";
import { db } from "@contract-builder/db";
import { user } from "@contract-builder/db/schema/auth";
import {
  subscriptionPlan as planTable,
  type subscriptionPlan,
  subscriptionUsage,
} from "@contract-builder/db/schema/subscription";
import { and, eq, sql } from "drizzle-orm";

export type QuotaKind = "download" | "edit" | "review";
type Plan = typeof subscriptionPlan.$inferSelect;

function planQuota(plan: Plan, kind: QuotaKind): number {
  if (kind === "download") {
    return plan.downloadQuota;
  }
  if (kind === "edit") {
    return plan.editQuota;
  }
  return plan.reviewQuota;
}

/** Current calendar month as "YYYY-MM" — the quota reset window. */
export function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The plan that applies to a user: their assigned (non-expired) subscription,
 * otherwise the default plan. Null if no default plan exists.
 */
export async function getEffectivePlan(userId: string): Promise<Plan | null> {
  const [u] = await db
    .select({
      planId: user.subscriptionPlanId,
      expiresAt: user.subscriptionExpiresAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (u?.planId && (!u.expiresAt || u.expiresAt > new Date())) {
    const [assigned] = await db
      .select()
      .from(planTable)
      .where(eq(planTable.id, u.planId))
      .limit(1);
    if (assigned) {
      return assigned;
    }
  }

  const [fallback] = await db
    .select()
    .from(planTable)
    .where(eq(planTable.isDefault, true))
    .limit(1);
  return fallback ?? null;
}

export async function getUsage(
  userId: string,
  periodKey: string
): Promise<{ downloadsUsed: number; editsUsed: number; reviewsUsed: number }> {
  const [row] = await db
    .select({
      downloadsUsed: subscriptionUsage.downloadsUsed,
      editsUsed: subscriptionUsage.editsUsed,
      reviewsUsed: subscriptionUsage.reviewsUsed,
    })
    .from(subscriptionUsage)
    .where(
      and(
        eq(subscriptionUsage.userId, userId),
        eq(subscriptionUsage.periodKey, periodKey)
      )
    )
    .limit(1);
  return row ?? { downloadsUsed: 0, editsUsed: 0, reviewsUsed: 0 };
}

function usedFor(
  usage: { downloadsUsed: number; editsUsed: number; reviewsUsed: number },
  kind: QuotaKind
): number {
  if (kind === "download") {
    return usage.downloadsUsed;
  }
  if (kind === "edit") {
    return usage.editsUsed;
  }
  return usage.reviewsUsed;
}

/**
 * Try to consume one unit of the user's monthly quota for `kind`. Increments
 * the usage counter when allowed. `remaining` is -1 for unlimited plans.
 */
export async function consumeQuota(
  userId: string,
  kind: QuotaKind
): Promise<{ allowed: boolean; remaining: number }> {
  const plan = await getEffectivePlan(userId);
  if (!plan) {
    return { allowed: false, remaining: 0 };
  }
  const quota = planQuota(plan, kind);
  const periodKey = currentPeriodKey();
  const usage = await getUsage(userId, periodKey);
  const used = usedFor(usage, kind);

  if (quota !== -1 && used >= quota) {
    return { allowed: false, remaining: 0 };
  }

  const increments = {
    download: { downloadsUsed: sql`${subscriptionUsage.downloadsUsed} + 1` },
    edit: { editsUsed: sql`${subscriptionUsage.editsUsed} + 1` },
    review: { reviewsUsed: sql`${subscriptionUsage.reviewsUsed} + 1` },
  } as const;

  await db
    .insert(subscriptionUsage)
    .values({
      id: randomUUID(),
      userId,
      periodKey,
      downloadsUsed: kind === "download" ? 1 : 0,
      editsUsed: kind === "edit" ? 1 : 0,
      reviewsUsed: kind === "review" ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: [subscriptionUsage.userId, subscriptionUsage.periodKey],
      set: increments[kind],
    });

  return { allowed: true, remaining: quota === -1 ? -1 : quota - used - 1 };
}
