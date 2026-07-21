import { Link, useLocation, useMatch } from "@tanstack/react-router";
import {
  CircleUser,
  FolderOpen,
  LogOut,
  type LucideIcon,
  PenLine,
  Shield,
  Users,
} from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { CommandSearchProvider } from "@/components/command-search/command-search-context";
import { CommandSearchDialog } from "@/components/command-search/command-search-dialog";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { looksLikePhone } from "@/lib/display-name";

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

// Routes that render their own full-screen layout (no app sidebar/header):
// the public landing, the auth screens, the invitation accept page and the
// public legal documents.
function useIsChromelessRoute() {
  const indexMatch = useMatch({ from: "/", shouldThrow: false });
  const loginMatch = useMatch({ from: "/login", shouldThrow: false });
  const registerMatch = useMatch({ from: "/register", shouldThrow: false });
  const onboardingMatch = useMatch({
    from: "/onboarding",
    shouldThrow: false,
  });
  const continueSignupMatch = useMatch({
    from: "/continue-signup",
    shouldThrow: false,
  });
  const acceptInviteMatch = useMatch({
    from: "/accept-invitation/$invitationId/",
    shouldThrow: false,
  });
  const privacyMatch = useMatch({ from: "/privacy", shouldThrow: false });
  const termsMatch = useMatch({ from: "/terms", shouldThrow: false });
  return Boolean(
    indexMatch ||
      loginMatch ||
      registerMatch ||
      onboardingMatch ||
      continueSignupMatch ||
      acceptInviteMatch ||
      privacyMatch ||
      termsMatch
  );
}

/**
 * better-auth не проставляет activeOrganizationId при входе. Раньше это делал
 * блок профиля в сайдбаре; после его удаления активацию держит оболочка —
 * от активной организации зависят заголовок «Моих документов» и привязка
 * платежей к организации.
 */
function useActiveOrgBootstrap() {
  const { data: organizations, isPending: isLoadingOrgs } =
    authClient.useListOrganizations();
  const { data: activeOrg, isPending: isLoadingActiveOrg } =
    authClient.useActiveOrganization();

  useEffect(() => {
    if (
      !(isLoadingOrgs || isLoadingActiveOrg || activeOrg) &&
      organizations &&
      organizations.length > 0
    ) {
      authClient.organization.setActive({
        organizationId: organizations[0].id,
      });
    }
  }, [activeOrg, organizations, isLoadingOrgs, isLoadingActiveOrg]);

  return activeOrg;
}

// Переход в админку: единственная точка входа после удаления меню профиля.
function HeaderAdminToggle() {
  const location = useLocation();
  const { data: session } = authClient.useSession();
  const isAdminContext = location.pathname.startsWith("/admin");

  if (!(session?.user as { isAdmin?: boolean } | undefined)?.isAdmin) {
    return null;
  }
  return (
    <Button
      aria-label={isAdminContext ? "Вернуться в приложение" : "Админка"}
      asChild
      className="size-8 text-foreground"
      size="icon-sm"
      variant="ghost"
    >
      <Link to={isAdminContext ? "/templates" : "/admin/templates"}>
        <Shield className="size-4" />
      </Link>
    </Button>
  );
}

// Иконка выхода в правом верхнем углу шапки (по макету — рядом с языком).
function HeaderSignOut() {
  const { data: session } = authClient.useSession();
  if (!session) {
    return null;
  }
  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    });
  };
  return (
    <Button
      aria-label="Выйти"
      className="size-8 text-foreground"
      onClick={handleSignOut}
      size="icon-sm"
      variant="ghost"
    >
      <LogOut className="size-4" />
    </Button>
  );
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const { title, icon: TitleIcon } = usePageHeader();
  const isChromeless = useIsChromelessRoute();
  const documentsMatch = useMatch({ from: "/documents", shouldThrow: false });
  const activeOrg = useActiveOrgBootstrap();
  const isDocuments = Boolean(documentsMatch);

  if (isChromeless) {
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
              {isDocuments &&
                activeOrg?.name &&
                !looksLikePhone(activeOrg.name) && (
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
              {/* Временно скрыто: команда (TeamAvatarStack + ShareAccessMenu) */}
              <LanguageSwitcher />
              <HeaderAdminToggle />
              <HeaderSignOut />
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <CommandSearchDialog />
    </CommandSearchProvider>
  );
}
