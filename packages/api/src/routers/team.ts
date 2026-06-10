import { randomUUID } from "node:crypto";
import { db } from "@contract-builder/db";
import { invitation, member, user } from "@contract-builder/db/schema/auth";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  ACCESS_LEVELS,
  accessLevelToRole,
  canEditDocuments,
  roleToAccessLevel,
} from "../constants/access";
import { editorProcedure, orgProcedure, router } from "../index";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const accessLevelSchema = z.enum(ACCESS_LEVELS);

/** Loads a member row scoped to the caller's organization, or throws 404. */
async function loadOrgMember(orgId: string, memberId: string) {
  const [found] = await db
    .select({ id: member.id, userId: member.userId, role: member.role })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, orgId)))
    .limit(1);
  if (!found) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Участник не найден" });
  }
  return found;
}

export const teamRouter = router({
  // Everyone in the org can see the team roster; only editors can mutate it.
  members: orgProcedure.query(async ({ ctx }) => {
    const members = await db
      .select({
        memberId: member.id,
        userId: member.userId,
        role: member.role,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, ctx.orgId));

    const invitations = await db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
      })
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, ctx.orgId),
          eq(invitation.status, "pending")
        )
      );

    return {
      members: members.map((m) => ({
        ...m,
        accessLevel: roleToAccessLevel(m.role),
      })),
      invitations: invitations.map((i) => ({
        ...i,
        accessLevel: roleToAccessLevel(i.role),
      })),
    };
  }),

  myAccess: orgProcedure.query(({ ctx }) => ({
    role: ctx.role,
    accessLevel: roleToAccessLevel(ctx.role),
    canEdit: canEditDocuments(ctx.role),
  })),

  invite: editorProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email(),
        accessLevel: accessLevelSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = accessLevelToRole(input.accessLevel);

      const [existingUser] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, input.email))
        .limit(1);

      // Known user → grant access immediately (no email delivery needed).
      if (existingUser) {
        const [existingMember] = await db
          .select({ id: member.id, role: member.role })
          .from(member)
          .where(
            and(
              eq(member.userId, existingUser.id),
              eq(member.organizationId, ctx.orgId)
            )
          )
          .limit(1);

        if (existingMember) {
          // Never silently downgrade the owner.
          if (existingMember.role === "owner") {
            return { status: "owner" as const };
          }
          await db
            .update(member)
            .set({ role })
            .where(eq(member.id, existingMember.id));
          return { status: "updated" as const };
        }

        await db.insert(member).values({
          id: randomUUID(),
          userId: existingUser.id,
          organizationId: ctx.orgId,
          role,
        });
        return { status: "added" as const };
      }

      // Unknown email → pending invitation (surfaced in the team list). No email
      // is sent: the project has no email provider configured yet.
      await db.insert(invitation).values({
        id: randomUUID(),
        email: input.email,
        inviterId: ctx.session.user.id,
        organizationId: ctx.orgId,
        role,
        status: "pending",
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      });
      return { status: "invited" as const };
    }),

  updateAccess: editorProcedure
    .input(z.object({ memberId: z.string(), accessLevel: accessLevelSchema }))
    .mutation(async ({ ctx, input }) => {
      const target = await loadOrgMember(ctx.orgId, input.memberId);
      if (target.role === "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Нельзя изменить доступ владельца",
        });
      }
      await db
        .update(member)
        .set({ role: accessLevelToRole(input.accessLevel) })
        .where(eq(member.id, target.id));
      return { success: true };
    }),

  remove: editorProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await loadOrgMember(ctx.orgId, input.memberId);
      if (target.role === "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Нельзя удалить владельца",
        });
      }
      if (target.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Нельзя удалить себя",
        });
      }
      await db.delete(member).where(eq(member.id, target.id));
      return { success: true };
    }),

  cancelInvite: editorProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(invitation)
        .where(
          and(
            eq(invitation.id, input.invitationId),
            eq(invitation.organizationId, ctx.orgId)
          )
        );
      return { success: true };
    }),
});
