import { env } from "@contract-builder/env/web";
import {
  inferAdditionalFields,
  organizationClient,
  phoneNumberClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL,
  plugins: [
    organizationClient(),
    phoneNumberClient(),
    inferAdditionalFields({
      user: {
        isAdmin: { type: "boolean", input: false },
        accountType: { type: "string", input: true, required: false },
      },
    }),
  ],
});
