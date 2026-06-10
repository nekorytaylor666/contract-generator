import { useMatch } from "@tanstack/react-router";
import {
  CircleUser,
  FolderOpen,
  type LucideIcon,
  PenLine,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { CommandSearchProvider } from "@/components/command-search/command-search-context";
import { CommandSearchDialog } from "@/components/command-search/command-search-dialog";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ShareAccessMenu } from "@/components/share-access-menu";
import { TeamAvatarStack } from "@/components/team-avatar-stack";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

import { AppSidebar } from "./app-sidebar";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

// Route-specific header configurations
function usePageHeader(): { title: string; icon: LucideIcon } {
  const { t } = useTranslation();
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
    return { title: t("nav.templates"), icon: FolderOpen };
  }

  if (documentsMatch) {
    return { title: t("nav.documents"), icon: FolderOpen };
  }

  if (teamMatch) {
    return { title: t("nav.team"), icon: Users };
  }

  if (profileMatch) {
    return { title: t("nav.profile"), icon: CircleUser };
  }

  return { title: t("nav.constructor"), icon: PenLine };
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
  const documentsMatch = useMatch({ from: "/documents", shouldThrow: false });
  const { data: activeOrg } = authClient.useActiveOrganization();
  const isDocuments = Boolean(documentsMatch);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <CommandSearchProvider>
      <SidebarProvider className="!h-svh !overflow-hidden">
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-[54px] shrink-0 items-center justify-between border-[#e5e5e5] border-b py-2 pr-6 pl-3">
            <div className="flex items-center gap-1.5 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <TitleIcon className="size-4" />
                {title}
              </span>
              {isDocuments && activeOrg?.name && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <span className="flex items-center gap-1.5 text-foreground">
                    <FolderOpen className="size-4 text-muted-foreground" />
                    {activeOrg.name}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isDocuments && (
                <>
                  <TeamAvatarStack />
                  <ShareAccessMenu />
                </>
              )}
              <LanguageSwitcher />
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <CommandSearchDialog />
    </CommandSearchProvider>
  );
}
