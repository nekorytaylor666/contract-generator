import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import {
  CircleUserIcon,
  CreditCardIcon,
  FilesIcon,
  FolderOpenIcon,
  GlobeIcon,
  LogoSignIcon,
  PanelLeftCloseIcon,
  UsersIcon,
} from "@/components/icons/sidebar-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { cn } from "@/lib/utils";
import { NavUser } from "./nav-user";

interface NavItem {
  titleKey: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const userNavigation: NavItem[] = [
  { titleKey: "nav.templates", url: "/templates", icon: FolderOpenIcon },
  { titleKey: "nav.documents", url: "/documents", icon: FilesIcon },
  { titleKey: "nav.team", url: "/team", icon: UsersIcon },
  { titleKey: "nav.profile", url: "/profile", icon: CircleUserIcon },
];

const adminNavigation: NavItem[] = [
  { titleKey: "nav.templates", url: "/admin/templates", icon: FolderOpenIcon },
  { titleKey: "nav.users", url: "/admin/users", icon: UsersIcon },
  { titleKey: "nav.purchases", url: "/admin/purchases", icon: FilesIcon },
  {
    titleKey: "nav.subscriptions",
    url: "/admin/subscriptions",
    icon: CreditCardIcon,
  },
];

// Collapsed (icon) state: square button, centered icon, label hidden.
const COLLAPSED_ICON =
  "group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>span:last-child]:hidden";

// Active item from the design: mauve brand tint (rgba(221,205,213,0.7)) with
// brand-colored icon + label.
const ACTIVE_ITEM =
  "data-active:bg-[#ddcdd5]/70 data-active:text-primary data-active:hover:bg-[#ddcdd5]/70";

function SidebarToggle() {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      aria-label="Свернуть или развернуть меню"
      className="size-8 text-sidebar-foreground"
      data-sidebar="trigger"
      onClick={toggleSidebar}
      size="icon-sm"
      variant="ghost"
    >
      <PanelLeftCloseIcon className="size-5" />
    </Button>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isAdminContext = location.pathname.startsWith("/admin");
  const navigation = isAdminContext ? adminNavigation : userNavigation;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-[54px] flex-row items-center justify-between px-4 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <Link
          aria-label={isAdminContext ? "ZHEBE · Админка" : "ZHEBE"}
          className="text-sidebar-foreground group-data-[collapsible=icon]:hidden"
          to={isAdminContext ? "/admin/templates" : "/templates"}
        >
          <LogoSignIcon className="h-4 w-[15px]" />
        </Link>
        <SidebarToggle />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navigation.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    className={`h-9 ${COLLAPSED_ICON} ${ACTIVE_ITEM}`}
                    isActive={
                      location.pathname === item.url ||
                      location.pathname.startsWith(`${item.url}/`)
                    }
                    tooltip={t(item.titleKey)}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{t(item.titleKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  className={`h-9 ${COLLAPSED_ICON}`}
                  tooltip={t("language.label")}
                >
                  <GlobeIcon />
                  <span>{t("language.label")}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top">
                {SUPPORTED_LANGUAGES.map((lng) => (
                  <DropdownMenuItem
                    className={cn(i18n.language === lng && "bg-muted")}
                    key={lng}
                    onSelect={() => {
                      i18n.changeLanguage(lng).catch(() => undefined);
                    }}
                  >
                    {t(`language.${lng}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
