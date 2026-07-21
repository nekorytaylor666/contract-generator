import { randomUUID } from "node:crypto";
import { isMailerConfigured } from "@contract-builder/auth/mailer";
import { db } from "@contract-builder/db";
import {
  invitation,
  member,
  organization,
  user,
} from "@contract-builder/db/schema/auth";
import { env } from "@contract-builder/env/server";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  ACCESS_LABELS,
  ACCESS_LEVELS,
  accessLevelToRole,
  canEditDocuments,
  roleToAccessLevel,
} from "../constants/access";
import {
  editorProcedure,
  orgProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "../index";

import { sendTeamInvitationEmail } from "../lib/mailer";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TRAILING_SLASH_REGEX = /\/$/;
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

/**
 * Emails a pending invitation. Never throws — a delivery failure shouldn't roll
 * back the invitation (it's already in the team list); returns whether it sent.
 */
async function emailInvitation(opts: {
  invitationId: string;
  orgId: string;
  to: string;
  inviterName: string;
  accessLevel: (typeof ACCESS_LEVELS)[number];
}): Promise<boolean> {
  if (!isMailerConfigured()) {
    return false;
  }
  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, opts.orgId))
    .limit(1);
  const base = env.CORS_ORIGIN.replace(TRAILING_SLASH_REGEX, "");
  try {
    await sendTeamInvitationEmail({
      to: opts.to,
      orgName: org?.name ?? "команда",
      inviterName: opts.inviterName,
      roleLabel: ACCESS_LABELS[opts.accessLevel],
      acceptUrl: `${base}/accept-invitation/${opts.invitationId}`,
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[mailer] invite email failed: ${message}\n`);
    return false;
  }
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

      // Unknown email → pending invitation, emailed via SMTP (if configured).
      const invitationId = randomUUID();
      await db.insert(invitation).values({
        id: invitationId,
        email: input.email,
        inviterId: ctx.session.user.id,
        organizationId: ctx.orgId,
        role,
        status: "pending",
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      });

      const emailSent = await emailInvitation({
        invitationId,
        orgId: ctx.orgId,
        to: input.email,
        inviterName:
          ctx.session.user.name || ctx.session.user.email || "Коллега",
        accessLevel: input.accessLevel,
      });

      return { status: "invited" as const, emailSent };
    }),

  // Public: invite details for the accept page (shown before sign-in too).
  getInvite: publicProcedure
    .input(z.object({ invitationId: z.string() }))
    .query(async ({ input }) => {
      const [inv] = await db
        .select({
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          orgName: organization.name,
        })
        .from(invitation)
        .innerJoin(organization, eq(organization.id, invitation.organizationId))
        .where(eq(invitation.id, input.invitationId))
        .limit(1);

      if (!inv) {
        return null;
      }
      return {
        email: inv.email,
        orgName: inv.orgName,
        accessLevel: roleToAccessLevel(inv.role),
        status: inv.status,
        expired: inv.expiresAt.getTime() < Date.now(),
      };
    }),

  // Accept an invitation: the signed-in user's email must match the invite.
  acceptInvite: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [inv] = await db
        .select()
        .from(invitation)
        .where(eq(invitation.id, input.invitationId))
        .limit(1);

      if (!inv || inv.status !== "pending") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Приглашение не найдено или уже использовано",
        });
      }
      if (inv.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Срок действия приглашения истёк",
        });
      }
      const userEmail = ctx.session.user.email?.toLowerCase();
      if (!userEmail || userEmail !== inv.email.toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Приглашение выписано на ${inv.email}. Войдите под этим адресом.`,
        });
      }

      const [existingMember] = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.userId, ctx.session.user.id),
            eq(member.organizationId, inv.organizationId)
          )
        )
        .limit(1);

      if (!existingMember) {
        await db.insert(member).values({
          id: randomUUID(),
          userId: ctx.session.user.id,
          organizationId: inv.organizationId,
          role: inv.role,
        });
      }
      await db
        .update(invitation)
        .set({ status: "accepted" })
        .where(eq(invitation.id, inv.id));

      return { organizationId: inv.organizationId };
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
