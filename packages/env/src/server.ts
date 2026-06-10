import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
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
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
