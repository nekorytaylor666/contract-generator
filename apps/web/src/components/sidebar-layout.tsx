import { useMatch } from "@tanstack/react-router";
import {
  CircleUser,
  FolderOpen,
  Globe,
  type LucideIcon,
  PenLine,
  Users,
} from "lucide-react";

import { CommandSearchProvider } from "@/components/command-search/command-search-context";
import { CommandSearchDialog } from "@/components/command-search/command-search-dialog";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { AppSidebar } from "./app-sidebar";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

// Route-specific header configurations
function usePageHeader(): { title: string; icon: LucideIcon } {
  const templatesMatch = useMatch({
    from: "/templates/",
    shouldThrow: false,
  });
  const documentsMatch = useMatch({
    from: "/documents",
    shouldThrow: false,
  });
  const profileMatch = useMatch({
    from: "/profile",
    shouldThrow: false,
  });
  const teamMatch = useMatch({
    from: "/team",
    shouldThrow: false,
  });

  if (templatesMatch) {
    return { title: "Шаблоны", icon: FolderOpen };
  }

  if (documentsMatch) {
    return { title: "Мои документы", icon: FolderOpen };
  }

  if (teamMatch) {
    return { title: "Команда", icon: Users };
  }

  if (profileMatch) {
    return { title: "Профиль", icon: CircleUser };
  }

  return { title: "Конструктор", icon: PenLine };
}

function useIsAuthRoute() {
  const loginMatch = useMatch({ from: "/login", shouldThrow: false });
  const onboardingMatch = useMatch({
    from: "/onboarding",
    shouldThrow: false,
  });
  const continueSignupMatch = useMatch({
    from: "/continue-signup",
    shouldThrow: false,
  });
  return Boolean(loginMatch || onboardingMatch || continueSignupMatch);
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const { title, icon: TitleIcon } = usePageHeader();
  const isAuthRoute = useIsAuthRoute();

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <CommandSearchProvider>
      <SidebarProvider className="!h-svh !overflow-hidden">
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-[54px] shrink-0 items-center justify-between border-[#e5e5e5] border-b py-2 pr-6 pl-3">
            <div className="flex items-center gap-2 rounded-md px-3 py-2">
              <TitleIcon className="size-4 text-foreground" />
              <span className="text-foreground text-sm">{title}</span>
            </div>
            <Globe className="size-4 text-foreground" />
          </header>
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <CommandSearchDialog />
    </CommandSearchProvider>
  );
}
