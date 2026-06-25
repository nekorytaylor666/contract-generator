import { createFileRoute } from "@tanstack/react-router";

import { AuthShell } from "@/components/auth-shell";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/register")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <AuthShell mode="register">
      <SignUpForm />
    </AuthShell>
  );
}
