import { db } from "@contract-builder/db";
import { user } from "@contract-builder/db/schema/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";

const goalsSchema = z.array(z.string().min(1)).max(10);
const legalsSchema = z.array(z.string().min(1)).max(20);
const industriesSchema = z.array(z.string().min(1)).max(10);
const outreachSchema = z.string().min(1).max(50);

const saveSchema = z.object({
  goals: goalsSchema.optional(),
  legals: legalsSchema.optional(),
  industries: industriesSchema.optional(),
  outreach: outreachSchema.optional(),
});

export const onboardingRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({
        accountType: user.accountType,
        goals: user.onboardingGoals,
        legals: user.onboardingLegals,
        industries: user.onboardingIndustries,
        outreach: user.onboardingOutreach,
        policyAcceptedAt: user.onboardingPolicyAcceptedAt,
        completedAt: user.onboardingCompletedAt,
      })
      .from(user)
      .where(eq(user.id, ctx.session.user.id))
      .limit(1);
    return row ?? null;
  }),

  save: protectedProcedure
    .input(saveSchema)
    .mutation(async ({ ctx, input }) => {
      await db
        .update(user)
        .set({
          ...(input.goals !== undefined && { onboardingGoals: input.goals }),
          ...(input.legals !== undefined && { onboardingLegals: input.legals }),
          ...(input.industries !== undefined && {
            onboardingIndustries: input.industries,
          }),
          ...(input.outreach !== undefined && {
            onboardingOutreach: input.outreach,
          }),
        })
        .where(eq(user.id, ctx.session.user.id));
      return { ok: true as const };
    }),

  complete: protectedProcedure
    .input(z.object({ acceptedPolicy: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      const now = new Date();
      await db
        .update(user)
        .set({
          onboardingPolicyAcceptedAt: now,
          onboardingCompletedAt: now,
        })
        .where(eq(user.id, ctx.session.user.id));
      return { ok: true as const };
    }),
});
