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
    // /continue-signup — умный хаб: сам решит показать пароль/орг-данные
    // или пустить в /onboarding, если регистрация фактически завершена.
    throw redirect({ to: "/continue-signup" });
  }

  return { session, organizations };
}

export async function requireSession() {
  const { data: session } = await authClient.getSession();
  return { session };
}

export async function requireAdmin() {
  const { data: session } = await authClient.getSession();
  if (!session) {
    throw redirect({ to: "/login" });
  }
  if (!(session.user as { isAdmin?: boolean }).isAdmin) {
    throw redirect({ to: "/" });
  }
  return { session };
}
