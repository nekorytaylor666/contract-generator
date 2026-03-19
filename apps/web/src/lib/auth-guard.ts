import { redirect } from "@tanstack/react-router";
import { authClient } from "./auth-client";

export async function requireAuth() {
  const { data: session } = await authClient.getSession();

  if (!session) {
    throw redirect({ to: "/login" });
  }

  const { data } = await authClient.organization.list();
  const organizations = data ?? [];

  if (organizations.length === 0) {
    throw redirect({ to: "/onboarding" });
  }

  return { session, organizations };
}

export async function requireSession() {
  const { data: session } = await authClient.getSession();
  return { session };
}
