import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AuthShell } from "@/components/auth-shell";
import SignInForm from "@/components/sign-in-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();

  return (
    <AuthShell mode="login">
      <SignInForm onSwitchToSignUp={() => navigate({ to: "/register" })} />
    </AuthShell>
  );
}
