import { createFileRoute } from "@tanstack/react-router";

import { PlansPage } from "@/components/plans-page";

export const Route = createFileRoute("/plans")({ component: App });

function App() {
  return <PlansPage />;
}
