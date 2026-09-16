import { redirect } from "@tanstack/react-router";
import { authClient } from "./auth-client";
import { queryClient, trpc } from "./trpc-client";

interface SignupStatus {
  accountType: "individual" | "legal" | null;
  hasPassword: boolean;
  hasOrganization: boolean;
  onboardingCompletedAt: Date | string | null;
}

// Регистрация считается завершённой только после онбординга. Проверка по
// «есть организация» недостаточна: у юр.лица организация появляется до
// онбординга, поэтому любая ссылка с лендинга («Открыть приложение»,
// карточка библиотеки, тарифы) вела в кабинет мимо него.
export function isSignupIncomplete(status: SignupStatus): boolean {
  const needsPassword = !status.hasPassword;
  const needsOrg = status.accountType === "legal" && !status.hasOrganization;
  const needsOnboarding = !status.onboardingCompletedAt;
  return needsPassword || needsOrg || needsOnboarding;
}

async function fetchSignupStatus(): Promise<SignupStatus | null> {
  try {
    // staleTime: 0 — статус меняется прямо по ходу регистрации (пароль,
    // организация, онбординг), кешированное значение здесь опасно. Ответ
    // при этом попадает в общий кеш и виден useQuery в /continue-signup.
    return await queryClient.fetchQuery({
      ...trpc.auth.signupStatus.queryOptions(),
      staleTime: 0,
    });
  } catch {
    // Сбой запроса не должен запирать пользователя вне кабинета — падаем
    // на старую проверку по организации ниже.
    return null;
  }
}

export async function requireAuth() {
  const { data: session } = await authClient.getSession();

  if (!session) {
    throw redirect({ to: "/login" });
  }

  const status = await fetchSignupStatus();
  if (status && isSignupIncomplete(status)) {
    // /continue-signup — умный хаб: сам решит показать пароль/орг-данные
    // или пустить в /onboarding.
    throw redirect({ to: "/continue-signup" });
  }

  const { data } = await authClient.organization.list();
  const organizations = data ?? [];

  if (organizations.length === 0) {
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
