import { createMiddleware } from "@tanstack/react-start";

import { authClient } from "@/lib/auth-client";

export const authMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    let session = null;
    try {
      session = await authClient.getSession({
        fetchOptions: {
          headers: request.headers,
        },
      });
    } catch {
      // Network error or server unreachable — treat as unauthenticated
    }
    return next({
      context: { session },
    });
  }
);
