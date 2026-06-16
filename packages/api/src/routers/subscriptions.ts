import { db } from "@contract-builder/db";
import { subscriptionPlan } from "@contract-builder/db/schema/subscription";
import { asc, eq } from "drizzle-orm";

import { protectedProcedure, router } from "../index";
import {
  currentPeriodKey,
  getEffectivePlan,
  getUsage,
} from "../lib/subscription";

function remaining(quota: number, used: number): number {
  return quota === -1 ? -1 : Math.max(0, quota - used);
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

  // The current user's effective plan + remaining monthly quotas.
  mySubscription: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const plan = await getEffectivePlan(userId);
    const usage = await getUsage(userId, currentPeriodKey());
    return {
      planId: plan?.id ?? null,
      planName: plan?.name ?? null,
      downloadQuota: plan?.downloadQuota ?? 0,
      editQuota: plan?.editQuota ?? 0,
      downloadsUsed: usage.downloadsUsed,
      editsUsed: usage.editsUsed,
      downloadRemaining: plan
        ? remaining(plan.downloadQuota, usage.downloadsUsed)
        : 0,
      editRemaining: plan ? remaining(plan.editQuota, usage.editsUsed) : 0,
    };
  }),
});
