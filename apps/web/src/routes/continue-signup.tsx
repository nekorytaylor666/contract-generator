import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import Loader from "@/components/loader";
import { SignUpOrgForm } from "@/components/sign-up-org-form";
import { SignUpPasswordForm } from "@/components/sign-up-password-form";
import { requireSession } from "@/lib/auth-guard";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/continue-signup")({
  component: ContinueSignupComponent,
  beforeLoad: async () => {
    const { session } = await requireSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
});

function ContinueSignupComponent() {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const statusQuery = useQuery(trpc.auth.signupStatus.queryOptions());

  const status = statusQuery.data;
  const needsPassword = status ? !status.hasPassword : false;
  const needsOrg = status
    ? status.accountType === "legal" && !status.hasOrganization
    : false;
  const allDone = status ? !(needsPassword || needsOrg) : false;

  // Всё дозаполнено — уводим дальше по воронке. Онбординг завершён, но
  // организации нет (её создание в конце онбординга сорвалось) — тоже в
  // /onboarding: он досоздаст организацию, иначе requireAuth зациклит нас.
  useEffect(() => {
    if (allDone && status) {
      const readyForApp =
        Boolean(status.onboardingCompletedAt) && status.hasOrganization;
      navigate({ to: readyForApp ? "/dashboard" : "/onboarding" });
    }
  }, [allDone, status, navigate]);

  if (statusQuery.isLoading || !status) {
    return <Loader />;
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted px-4 py-8 sm:px-6 sm:py-12">
      <main className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl sm:p-8">
        {needsPassword && (
          <SignUpPasswordForm onDone={() => statusQuery.refetch()} />
        )}
        {!needsPassword && needsOrg && (
          <SignUpOrgForm onDone={() => statusQuery.refetch()} />
        )}
        {allDone && <Loader />}
      </main>
    </div>
  );
}
