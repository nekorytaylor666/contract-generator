import { expo } from "@better-auth/expo";
import { db } from "@contract-builder/db";
// biome-ignore lint/performance/noNamespaceImport: drizzle adapter needs the full schema
import * as schema from "@contract-builder/db/schema/auth";
import { allowedWebOrigins, env } from "@contract-builder/env/server";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import {
  emailOTP,
  organization,
  phoneNumber,
  twoFactor,
} from "better-auth/plugins";

import {
  isMailerConfigured,
  sendPasswordResetEmail,
  sendTwoFactorEmail,
} from "./mailer";
import { isSmsConfigured, sendSms } from "./sms";

// Код для смены пароля живёт 10 минут (и в письме, и в SMS).
const PASSWORD_RESET_OTP_TTL_SECONDS = 10 * 60;

// Код 2FA из письма живёт 10 минут (плагин принимает минуты).
const TWO_FACTOR_OTP_TTL_MINUTES = 10;
// Сколько живёт «полусессия» между паролем и вводом кода 2FA.
const TWO_FACTOR_CHALLENGE_TTL_SECONDS = 10 * 60;

// twoFactor-плагин перехватывает только парольные входы (/sign-in/email,
// /sign-in/phone-number). Вход по коду из SMS (/phone-number/verify) создаёт
// сессию мимо него — закрываем дыру тем же механизмом: сессию гасим, ставим
// 2FA-куку и отвечаем twoFactorRedirect, дальше клиент запрашивает код на почту.
const twoFactorPhoneVerifyGate = {
  id: "two-factor-phone-verify-gate",
  hooks: {
    after: [
      {
        matcher: (context) => context.path === "/phone-number/verify",
        handler: createAuthMiddleware(async (ctx) => {
          const data = ctx.context.newSession;
          const twoFactorEnabled = (
            data?.user as { twoFactorEnabled?: boolean | null } | undefined
          )?.twoFactorEnabled;
          if (!(data && twoFactorEnabled)) {
            return;
          }
          deleteSessionCookie(ctx, true);
          await ctx.context.internalAdapter.deleteSession(data.session.token);
          const twoFactorCookie = ctx.context.createAuthCookie("two_factor", {
            maxAge: TWO_FACTOR_CHALLENGE_TTL_SECONDS,
          });
          const identifier = `2fa-${generateRandomString(20)}`;
          await ctx.context.internalAdapter.createVerificationValue({
            value: data.user.id,
            identifier,
            expiresAt: new Date(
              Date.now() + TWO_FACTOR_CHALLENGE_TTL_SECONDS * 1000
            ),
          });
          await ctx.setSignedCookie(
            twoFactorCookie.name,
            identifier,
            ctx.context.secret,
            twoFactorCookie.attributes
          );
          return ctx.json({ twoFactorRedirect: true });
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;

// Enable Google sign-in only when credentials are configured.
const googleProvider =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",

    schema,
  }),
  trustedOrigins: [...allowedWebOrigins, "mybettertapp://", "exp://"],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: googleProvider,
  user: {
    additionalFields: {
      isAdmin: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
      accountType: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },
  plugins: [
    expo(),
    organization(),
    phoneNumber({
      // С настроенным Mobizon шлём настоящий код (генерацию и проверку делает
      // сам плагин). Без ключа — dev-заглушка: ничего не шлём, код "111111".
      expiresIn: PASSWORD_RESET_OTP_TTL_SECONDS,
      ...(isSmsConfigured()
        ? {
            sendOTP: async ({ phoneNumber: phone, code }) => {
              await sendSms(phone, `Zhebe: код подтверждения ${code}`);
            },
            sendPasswordResetOTP: async ({ phoneNumber: phone, code }) => {
              await sendSms(phone, `Zhebe: код для смены пароля ${code}`);
            },
          }
        : {
            sendOTP: ({ phoneNumber: phone }) => {
              process.stderr.write(`[OTP stub] ${phone}: используйте 111111\n`);
            },
            verifyOTP: ({ code }) => code === "111111",
            // Для сброса пароля заглушки с фиксированным кодом нет — печатаем
            // настоящий сгенерированный код.
            sendPasswordResetOTP: ({ phoneNumber: phone, code }) => {
              process.stderr.write(
                `[OTP stub] ${phone}: код для смены пароля ${code}\n`
              );
            },
          }),
      signUpOnVerification: {
        // Плагин требует строку — даём временный маркер, который сразу же
        // обнулим в callbackOnVerification, чтобы email хранился как NULL
        // для phone-only регистраций.
        getTempEmail: (phone) => `${phone.replace(/\D/g, "")}@phone.local`,
        getTempName: (phone) => phone,
      },
      callbackOnVerification: async ({ user }, ctx) => {
        if (user.email?.endsWith("@phone.local")) {
          // better-auth типизирует email как обязательный string, но в нашей
          // схеме колонка nullable — обнуляем напрямую.
          await ctx?.context.internalAdapter.updateUser(user.id, {
            email: null as unknown as string,
          });
        }
      },
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: PASSWORD_RESET_OTP_TTL_SECONDS,
      // Кодовый вход по почте не используем — только сброс пароля.
      disableSignUp: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "forget-password") {
          // Не рассылаем коды для sign-in/email-verification, чтобы плагин
          // не открывал вход по коду из письма.
          return;
        }
        if (isMailerConfigured()) {
          await sendPasswordResetEmail(email, otp);
        } else {
          process.stderr.write(
            `[Email OTP stub] ${email}: код для смены пароля ${otp}\n`
          );
        }
      },
    }),
    twoFactor({
      otpOptions: {
        period: TWO_FACTOR_OTP_TTL_MINUTES,
        sendOTP: async ({ user, otp }) => {
          if (!user.email) {
            // 2FA включается только при наличии почты — сюда попадать не должны.
            process.stderr.write(
              `[2FA OTP] у ${user.id} нет почты, код не отправлен\n`
            );
            return;
          }
          if (isMailerConfigured()) {
            await sendTwoFactorEmail(user.email, otp);
          } else {
            process.stderr.write(
              `[2FA OTP stub] ${user.email}: код для входа ${otp}\n`
            );
          }
        },
      },
    }),
    twoFactorPhoneVerifyGate,
  ],
});
