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
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    // Robokassa payment gateway. Optional so the server still boots when
    // payments aren't configured; the payment lib throws a clear error if a
    // checkout is attempted without them.
    ROBOKASSA_MERCHANT_LOGIN: z.string().min(1).optional(),
    ROBOKASSA_PASSWORD_1: z.string().min(1).optional(),
    ROBOKASSA_PASSWORD_2: z.string().min(1).optional(),
    ROBOKASSA_IS_TEST: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    // Pass SuccessUrl2/FailUrl2 per payment (return the browser to our own
    // server handlers) instead of relying on the cabinet SuccessURL/FailURL.
    // Requires "additional Success/Fail URL" enabled in the Robokassa cabinet —
    // otherwise the init signature won't match and payments fail. Keep "false"
    // until that's enabled.
    ROBOKASSA_DYNAMIC_URLS: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
