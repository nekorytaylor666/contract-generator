import { db } from "@contract-builder/db";
import { member } from "@contract-builder/db/schema/auth";
import { initTRPC, TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { canEditDocuments } from "./constants/access";
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
  const userId = ctx.session.user.id;
  const activeOrgId = ctx.session.session.activeOrganizationId;

  // Prefer the active org membership; fall back to the user's first membership
  // (better-auth doesn't auto-activate an org on sign-in). We also read the
  // member's `role` so downstream procedures can gate edit permissions.
  let [membership] = activeOrgId
    ? await db
        .select({ organizationId: member.organizationId, role: member.role })
        .from(member)
        .where(
          and(eq(member.userId, userId), eq(member.organizationId, activeOrgId))
        )
        .limit(1)
    : [];

  if (!membership) {
    [membership] = await db
      .select({ organizationId: member.organizationId, role: member.role })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1);
  }

  if (!membership) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "User has no organization",
    });
  }

  return next({
    ctx: { ...ctx, orgId: membership.organizationId, role: membership.role },
  });
});

/**
 * Like `orgProcedure`, but requires the caller to have edit permission
 * ("full" access = owner/admin). View-only members are rejected.
 */
export const editorProcedure = orgProcedure.use(({ ctx, next }) => {
  if (!canEditDocuments(ctx.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Недостаточно прав: режим просмотра",
    });
  }
  return next({ ctx });
});
