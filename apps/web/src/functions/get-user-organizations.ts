import { createServerFn } from "@tanstack/react-start";

import { authClient } from "@/lib/auth-client";
import { authMiddleware } from "@/middleware/auth";

export const getUserOrganizations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context, request }) => {
    if (!context.session) {
      return { organizations: [] };
    }

    const result = await authClient.organization.list({
      fetchOptions: {
        headers: request.headers,
      },
    });

    return { organizations: result.data ?? [] };
  });
