import { useMatch } from "@tanstack/react-router";
import { CommandSearchProvider } from "@/components/command-search/command-search-context";
import { CommandSearchDialog } from "@/components/command-search/command-search-dialog";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { AppSidebar } from "./app-sidebar";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

// Route-specific header configurations
function usePageHeader() {
  const templatesMatch = useMatch({
    from: "/templates/",
    shouldThrow: false,
  });
  const documentsMatch = useMatch({
    from: "/documents",
    shouldThrow: false,
  });

  if (templatesMatch) {
    return {
      title: "Шаблоны договоров",
    };
  }

  if (documentsMatch) {
    return {
      title: "Мои документы",
    };
  }

  return {
    title: "Конструктор договоров",
  };
}

function useIsAuthRoute() {
  const loginMatch = useMatch({ from: "/login", shouldThrow: false });
  const onboardingMatch = useMatch({
    from: "/onboarding",
    shouldThrow: false,
  });
  return Boolean(loginMatch || onboardingMatch);
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const { title } = usePageHeader();
  const isAuthRoute = useIsAuthRoute();

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <CommandSearchProvider>
      <SidebarProvider className="!h-svh !overflow-hidden">
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-4 border-b px-4">
            <h1 className="font-semibold text-base text-foreground">{title}</h1>
          </header>
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <CommandSearchDialog />
    </CommandSearchProvider>
  );
}
