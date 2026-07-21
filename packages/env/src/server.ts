import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    // Google OAuth (better-auth social provider). Optional so the server boots
    // without it; the Google sign-in button only works when both are set.
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    // SMTP for transactional email (team invitations). Optional so the server
    // boots without it; invites just won't email until USER + PASSWORD are set.
    // For Gmail use an App Password (smtp.gmail.com:465).
    SMTP_HOST: z.string().min(1).default("smtp.gmail.com"),
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    // Optional display "From" (e.g. "Zhebe <no-reply@zhebe.kz>"); defaults to SMTP_USER.
    SMTP_FROM: z.string().min(1).optional(),
    // Mobizon SMS gateway (api.mobizon.kz) for phone OTP. Optional so the
    // server boots without it — the phone sign-in then falls back to the dev
    // stub (code "111111", nothing is sent).
    MOBIZON_API_KEY: z.string().min(1).optional(),
    MOBIZON_API_URL: z.url().default("https://api.mobizon.kz"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    // Robokassa payment gateway. Optional so the server still boots when
    // payments aren't configured; the payment lib throws a clear error if a
    // checkout is attempted without them.
    ROBOKASSA_MERCHANT_LOGIN: z.string().min(1).optional(),
    ROBOKASSA_PASSWORD_1: z.string().min(1).optional(),
    ROBOKASSA_PASSWORD_2: z.string().min(1).optional(),
    // Public base URL Robokassa can reach (e.g. an ngrok tunnel like
    // https://abc123.ngrok-free.app). Used for the SuccessUrl2/FailUrl2 return
    // URLs; falls back to BETTER_AUTH_URL when unset. Also where you point the
    // cabinet ResultURL: <ROBOKASSA_PUBLIC_URL>/result/payment. When set, the
    // gateway runs in TEST mode (IsTest=1); empty = live payments.
    ROBOKASSA_PUBLIC_URL: z.url().optional(),
    // Pass SuccessUrl2/FailUrl2 per payment (return the browser to our own
    // server handlers) instead of relying on the cabinet SuccessURL/FailURL.
    // Requires "additional Success/Fail URL" enabled in the Robokassa cabinet —
    // otherwise the init signature won't match and payments fail. Keep "false"
    // until that's enabled.
    ROBOKASSA_DYNAMIC_URLS: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    // Cloudflare Images: template preview photos are uploaded there and served
    // from imagedelivery.net. Optional so the server boots without them — the
    // photo cache then falls back to base64-in-DB (old behavior). All three of
    // ACCOUNT_ID / ACCOUNT_HASH / API_TOKEN must be set to enable uploads.
    CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
    CLOUDFLARE_IMAGES_ACCOUNT_HASH: z.string().min(1).optional(),
    CLOUDFLARE_IMAGES_API_TOKEN: z.string().min(1).optional(),
    CLOUDFLARE_IMAGES_VARIANT: z.string().min(1).default("public"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

// Allowed web origins for CORS + better-auth. Browsers treat localhost and
// 127.0.0.1 as different origins, so include both variants of CORS_ORIGIN.
export const allowedWebOrigins: string[] = (() => {
  const origin = env.CORS_ORIGIN;
  const twin = origin.includes("localhost")
    ? origin.replace("localhost", "127.0.0.1")
    : origin.replace("127.0.0.1", "localhost");
  const res = twin === origin ? [origin] : [origin, twin];
  console.log("allowedWebOrigins", res);

  return res;
})();
