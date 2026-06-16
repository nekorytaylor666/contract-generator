import { randomUUID } from "node:crypto";
import { db } from "@contract-builder/db";
import { user } from "@contract-builder/db/schema/auth";
import {
  subscriptionPlan as planTable,
  type subscriptionPlan,
  subscriptionUsage,
} from "@contract-builder/db/schema/subscription";
import { and, eq, sql } from "drizzle-orm";

export type QuotaKind = "download" | "edit";
type Plan = typeof subscriptionPlan.$inferSelect;

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
): Promise<{ downloadsUsed: number; editsUsed: number }> {
  const [row] = await db
    .select({
      downloadsUsed: subscriptionUsage.downloadsUsed,
      editsUsed: subscriptionUsage.editsUsed,
    })
    .from(subscriptionUsage)
    .where(
      and(
        eq(subscriptionUsage.userId, userId),
        eq(subscriptionUsage.periodKey, periodKey)
      )
    )
    .limit(1);
  return row ?? { downloadsUsed: 0, editsUsed: 0 };
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
  const quota = kind === "download" ? plan.downloadQuota : plan.editQuota;
  const periodKey = currentPeriodKey();
  const usage = await getUsage(userId, periodKey);
  const used = kind === "download" ? usage.downloadsUsed : usage.editsUsed;

  if (quota !== -1 && used >= quota) {
    return { allowed: false, remaining: 0 };
  }

  await db
    .insert(subscriptionUsage)
    .values({
      id: randomUUID(),
      userId,
      periodKey,
      downloadsUsed: kind === "download" ? 1 : 0,
      editsUsed: kind === "edit" ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: [subscriptionUsage.userId, subscriptionUsage.periodKey],
      set:
        kind === "download"
          ? { downloadsUsed: sql`${subscriptionUsage.downloadsUsed} + 1` }
          : { editsUsed: sql`${subscriptionUsage.editsUsed} + 1` },
    });

  return { allowed: true, remaining: quota === -1 ? -1 : quota - used - 1 };
}
