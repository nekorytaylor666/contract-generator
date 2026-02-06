import { Link, useLocation } from "@tanstack/react-router";
import {
  Bookmark,
  FileText,
  FolderOpen,
  Globe,
  HelpCircle,
  Settings,
} from "lucide-react";

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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";

const navigation = [
  {
    title: "Шаблоны",
    url: "/templates",
    icon: FolderOpen,
  },
  {
    title: "Мои документы",
    url: "/documents",
    icon: FileText,
  },
  {
    title: "Закладки",
    url: "/bookmarks",
    icon: Bookmark,
  },
  {
    title: "Поддержка",
    url: "/support",
    icon: HelpCircle,
  },
  {
    title: "Настройки",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="flex-row items-center justify-between px-4 py-3">
        <span className="font-semibold text-lg tracking-tight">SHART</span>
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      location.pathname === item.url ||
                      location.pathname.startsWith(`${item.url}/`)
                    }
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
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
            <SidebarMenuButton tooltip="Сменить язык">
              <Globe />
              <span>Сменить язык</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
