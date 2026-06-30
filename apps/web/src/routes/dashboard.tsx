import { createFileRoute, redirect } from "@tanstack/react-router";

import { requireAuth } from "@/lib/auth-guard";

export const Route = createFileRoute("/dashboard")({
  // No dashboard yet — after auth, send users straight to the templates
  // catalogue. requireAuth still gates login / org onboarding first.
  beforeLoad: async () => {
    await requireAuth();
    throw redirect({ to: "/templates" });
  },
});
