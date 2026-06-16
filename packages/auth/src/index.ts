import { expo } from "@better-auth/expo";
import { db } from "@contract-builder/db";
// biome-ignore lint/performance/noNamespaceImport: drizzle adapter needs the full schema
import * as schema from "@contract-builder/db/schema/auth";
import { env } from "@contract-builder/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, phoneNumber } from "better-auth/plugins";

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
  trustedOrigins: [env.CORS_ORIGIN, "mybettertapp://", "exp://"],
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
      // Dev-заглушка: ничего не шлём, код всегда "111111". Подменить на
      // SMS-провайдера + убрать verifyOTP, чтобы заработала встроенная
      // генерация и проверка.
      sendOTP: ({ phoneNumber: phone }) => {
        process.stderr.write(`[OTP stub] ${phone}: используйте 111111\n`);
      },
      verifyOTP: ({ code }) => code === "111111",
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
  ],
});
