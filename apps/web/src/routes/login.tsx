import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  const [showSignUp, setShowSignUp] = useState(false);

  return (
    <div className="flex h-screen w-full">
      <div className="hidden w-1/2 bg-primary lg:block" />
      <div className="flex w-full flex-1 items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-md">
          {showSignUp ? (
            <SignUpForm onSwitchToSignIn={() => setShowSignUp(false)} />
          ) : (
            <SignInForm onSwitchToSignUp={() => setShowSignUp(true)} />
          )}
        </div>
      </div>
    </div>
  );
}
