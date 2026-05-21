import { auth } from "@contract-builder/auth";
import { db } from "@contract-builder/db";
import {
  account,
  member,
  organization,
  user,
} from "@contract-builder/db/schema/auth";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";

export const authRouter = router({
  // Единый статус незавершённой регистрации — питает /continue-signup и гварды.
  signupStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [profile] = await db
      .select({
        accountType: user.accountType,
        onboardingCompletedAt: user.onboardingCompletedAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const [credential] = await db
      .select({ id: account.id })
      .from(account)
      .where(
        and(eq(account.userId, userId), eq(account.providerId, "credential"))
      )
      .limit(1);

    const [membership] = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1);

    return {
      accountType: (profile?.accountType ?? null) as
        | "individual"
        | "legal"
        | null,
      hasPassword: Boolean(credential),
      hasOrganization: Boolean(membership),
      onboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
    };
  }),
  setPassword: protectedProcedure
    .input(z.object({ newPassword: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await auth.api.setPassword({
          body: { newPassword: input.newPassword },
          headers: ctx.headers,
        });
        return { ok: true as const };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Не удалось установить пароль";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),

  // Step-2 для юр.лица: создаём организацию + проставляем ФИО/должность пользователю.
  completeOrgStep: protectedProcedure
    .input(
      z.object({
        orgName: z.string().min(1, "Введите название организации"),
        bin: z.string().regex(/^\d{12}$/, "БИН — 12 цифр, без пробелов"),
        fullName: z.string().min(1, "Введите имя и фамилию"),
        position: z.string().min(1, "Введите должность"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const slugBase =
          input.orgName
            .toLowerCase()
            .replace(/[^a-z0-9а-яё]+/gi, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 40) || "org";
        const slug = `${slugBase}-${Date.now()}`;

        const created = await auth.api.createOrganization({
          headers: ctx.headers,
          body: {
            name: input.orgName,
            slug,
          },
        });
        if (!created) {
          throw new Error("Не удалось создать организацию");
        }
        const orgId =
          (created as { id?: string }).id ??
          (created as { organization?: { id?: string } }).organization?.id;
        if (orgId) {
          await db
            .update(organization)
            .set({ bin: input.bin })
            .where(eq(organization.id, orgId));
        }

        await db
          .update(user)
          .set({ name: input.fullName, position: input.position })
          .where(eq(user.id, ctx.session.user.id));

        return { ok: true as const };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Не удалось создать организацию";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),
});
