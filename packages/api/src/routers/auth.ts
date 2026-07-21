import { auth } from "@contract-builder/auth";
import { db } from "@contract-builder/db";
import {
  account,
  member,
  organization,
  session,
  user,
} from "@contract-builder/db/schema/auth";
import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import {
  checkCurrentPassword,
  clearPasswordAttempts,
} from "../lib/password-guard";

const newPasswordSchema = z
  .string()
  .min(8)
  // better-auth ограничивает пароль 128 символами; держим тот же предел,
  // иначе слишком длинный пароль упирается в неотображаемую ошибку.
  .max(128)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/\d/);

// «Забыли пароль?»: код отправляется на почту или телефон пользователя.
// Повторная отправка — не чаще раза в минуту на канал (better-auth сам
// ограничивает подбор кода: 3 попытки, срок жизни 10 минут).
const RESET_CODE_COOLDOWN_MS = 60 * 1000;
const resetCodeLastSentAt = new Map<string, number>();

const resetChannelSchema = z.enum(["email", "phone"]);
const resetCodeSchema = z.string().regex(/^\d{6}$/);

async function getResetIdentifier(
  userId: string,
  channel: "email" | "phone"
): Promise<string | null> {
  const [row] = await db
    .select({ email: user.email, phoneNumber: user.phoneNumber })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const identifier = channel === "email" ? row?.email : row?.phoneNumber;
  return identifier ?? null;
}

export const authRouter = router({
  // Шаг 1 смены пароля: проверка текущего пароля с лимитом попыток.
  verifyPassword: protectedProcedure
    .input(z.object({ password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const check = await checkCurrentPassword(
        ctx.session.user.id,
        input.password
      );
      if (check.status === "ok") {
        return { status: "ok" as const };
      }
      return check;
    }),

  // Шаг 2 смены пароля: повторно проверяет текущий пароль (нельзя обойти
  // шаг 1 прямым вызовом) и меняет его через better-auth.
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: newPasswordSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const check = await checkCurrentPassword(
        ctx.session.user.id,
        input.currentPassword
      );
      if (check.status !== "ok") {
        return check;
      }

      const authContext = await auth.$context;
      const samePassword = await authContext.password.verify({
        hash: check.hash,
        password: input.newPassword,
      });
      if (samePassword) {
        return { status: "same_password" as const };
      }

      try {
        // revokeOtherSessions отзывает ВСЕ сессии (включая текущую) и выдаёт
        // новый токен через set-cookie — пробрасываем его клиенту, иначе
        // пользователя разлогинит.
        const { headers: authResponseHeaders } = await auth.api.changePassword({
          body: {
            currentPassword: input.currentPassword,
            newPassword: input.newPassword,
            revokeOtherSessions: true,
          },
          headers: ctx.headers,
          returnHeaders: true,
        });
        for (const cookie of authResponseHeaders.getSetCookie()) {
          ctx.resHeaders.append("set-cookie", cookie);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Не удалось изменить пароль";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
      return { status: "ok" as const };
    }),

  // «Забыли пароль?», шаг 1: отправить 6-значный код на почту или телефон.
  requestPasswordResetCode: protectedProcedure
    .input(z.object({ channel: resetChannelSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const identifier = await getResetIdentifier(userId, input.channel);
      if (!identifier) {
        return { status: "no_identifier" as const };
      }

      const cooldownKey = `${userId}:${input.channel}`;
      const lastSentAt = resetCodeLastSentAt.get(cooldownKey);
      const now = Date.now();
      if (lastSentAt && now - lastSentAt < RESET_CODE_COOLDOWN_MS) {
        return {
          status: "cooldown" as const,
          retryAfterSeconds: Math.ceil(
            (RESET_CODE_COOLDOWN_MS - (now - lastSentAt)) / 1000
          ),
        };
      }
      resetCodeLastSentAt.set(cooldownKey, now);

      try {
        if (input.channel === "email") {
          await auth.api.requestPasswordResetEmailOTP({
            body: { email: identifier },
          });
        } else {
          await auth.api.requestPasswordResetPhoneNumber({
            body: { phoneNumber: identifier },
          });
        }
      } catch (err) {
        // Отправка не удалась — не сжигаем кулдаун, дадим повторить сразу.
        resetCodeLastSentAt.delete(cooldownKey);
        const message =
          err instanceof Error ? err.message : "Не удалось отправить код";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
      return {
        status: "sent" as const,
        retryAfterSeconds: Math.ceil(RESET_CODE_COOLDOWN_MS / 1000),
      };
    }),

  // «Забыли пароль?», шаг 2: проверить код и установить новый пароль.
  resetPasswordWithCode: protectedProcedure
    .input(
      z.object({
        channel: resetChannelSchema,
        code: resetCodeSchema,
        newPassword: newPasswordSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const identifier = await getResetIdentifier(userId, input.channel);
      if (!identifier) {
        return { status: "no_identifier" as const };
      }

      // Есть ли у пользователя уже пароль — нужно ниже, чтобы досоздать
      // credential у phone-only аккаунтов. Сравнение нового пароля с текущим
      // здесь НЕ делаем: до проверки кода это был бы оракул текущего пароля
      // (перебор в обход лимита попыток). Пользователь, забывший пароль, его
      // всё равно не знает.
      const [credential] = await db
        .select({ password: account.password })
        .from(account)
        .where(
          and(eq(account.userId, userId), eq(account.providerId, "credential"))
        )
        .limit(1);

      try {
        if (input.channel === "email") {
          await auth.api.resetPasswordEmailOTP({
            body: {
              email: identifier,
              otp: input.code,
              password: input.newPassword,
            },
          });
        } else {
          await auth.api.resetPasswordPhoneNumber({
            body: {
              phoneNumber: identifier,
              otp: input.code,
              newPassword: input.newPassword,
            },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (
          message.includes("Invalid OTP") ||
          message.includes("OTP not found")
        ) {
          return { status: "invalid_code" as const };
        }
        if (message.includes("OTP expired")) {
          return { status: "code_expired" as const };
        }
        if (message.includes("Too many attempts")) {
          return { status: "too_many_attempts" as const };
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: message || "Не удалось изменить пароль",
        });
      }

      // Телефонный reset better-auth только обновляет существующий
      // credential-аккаунт: у phone-only пользователя без пароля он молча
      // ничего не меняет. Досоздаём пароль через setPassword.
      if (!credential?.password) {
        const [created] = await db
          .select({ password: account.password })
          .from(account)
          .where(
            and(
              eq(account.userId, userId),
              eq(account.providerId, "credential")
            )
          )
          .limit(1);
        if (!created?.password) {
          await auth.api.setPassword({
            body: { newPassword: input.newPassword },
            headers: ctx.headers,
          });
        }
      }

      // Отзываем остальные сессии (текущая остаётся) и сбрасываем счётчик
      // неудачных попыток смены пароля.
      await db
        .delete(session)
        .where(
          and(
            eq(session.userId, userId),
            ne(session.token, ctx.session.session.token)
          )
        );
      clearPasswordAttempts(userId);
      return { status: "ok" as const };
    }),

  // Включение 2FA, шаг 1: пароль с тем же лимитом попыток, что и смена
  // пароля. better-auth создаёт секрет, но twoFactorEnabled станет true только
  // после подтверждения кода из письма (клиент зовёт twoFactor.sendOtp /
  // verifyOtp напрямую — им нужны куки сессии).
  twoFactorEnable: protectedProcedure
    .input(z.object({ password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [row] = await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      if (!row?.email) {
        // Коды 2FA приходят на почту — без неё включать нечего.
        return { status: "no_email" as const };
      }

      const check = await checkCurrentPassword(userId, input.password);
      if (check.status !== "ok") {
        return check;
      }

      try {
        await auth.api.enableTwoFactor({
          body: { password: input.password },
          headers: ctx.headers,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Не удалось включить двухфакторную аутентификацию";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
      return { status: "ok" as const, email: row.email };
    }),

  // Отключение 2FA — тоже за паролем с лимитом попыток.
  twoFactorDisable: protectedProcedure
    .input(z.object({ password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const check = await checkCurrentPassword(
        ctx.session.user.id,
        input.password
      );
      if (check.status !== "ok") {
        return check;
      }

      try {
        // Плагин пересоздаёт сессию и выдаёт новый токен через set-cookie —
        // пробрасываем клиенту, иначе пользователя разлогинит.
        const { headers: authResponseHeaders } =
          await auth.api.disableTwoFactor({
            body: { password: input.password },
            headers: ctx.headers,
            returnHeaders: true,
          });
        for (const cookie of authResponseHeaders.getSetCookie()) {
          ctx.resHeaders.append("set-cookie", cookie);
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Не удалось отключить двухфакторную аутентификацию";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
      return { status: "ok" as const };
    }),

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
    .input(z.object({ newPassword: newPasswordSchema }))
    .mutation(async ({ ctx, input }) => {
      // Открытый setPassword нужен только на шаге регистрации. Позже пароль
      // без шаг-апа мог бы создать угонщик сессии phone-only аккаунта — и
      // этим паролем пройти защиту смены контакта. После онбординга пароль
      // ставится только через «Забыли пароль?» (код на текущий контакт).
      const [profile] = await db
        .select({ onboardingCompletedAt: user.onboardingCompletedAt })
        .from(user)
        .where(eq(user.id, ctx.session.user.id))
        .limit(1);
      if (profile?.onboardingCompletedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Пароль уже нельзя установить этим способом. Используйте «Забыли пароль?».",
        });
      }
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
