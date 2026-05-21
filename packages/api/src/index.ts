import { db } from "@contract-builder/db";
import { member } from "@contract-builder/db/schema/auth";
import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!(ctx.session.user as { isAdmin?: boolean }).isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

/**
 * Procedure that resolves the user's active organization, falling back to
 * the first membership if `session.activeOrganizationId` is not set
 * (better-auth doesn't auto-activate the first org on sign-in).
 */
export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  let orgId = ctx.session.session.activeOrganizationId;
  if (!orgId) {
    const [first] = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, ctx.session.user.id))
      .limit(1);
    orgId = first?.organizationId ?? null;
  }
  if (!orgId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "User has no organization",
    });
  }
  return next({ ctx: { ...ctx, orgId } });
});
