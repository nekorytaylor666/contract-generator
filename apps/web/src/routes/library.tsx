import { createFileRoute } from "@tanstack/react-router";

import { LibraryPage } from "@/components/library-page";

export const Route = createFileRoute("/library")({ component: App });

function App() {
  return <LibraryPage />;
}
