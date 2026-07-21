import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  CircleUserIcon,
  CreditCardIcon,
  FilesIcon,
  FolderOpenIcon,
  PanelLeftCloseIcon,
  UsersIcon,
} from "@/components/icons/sidebar-icons";
import { Button } from "@/components/ui/button";
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
import { ZhebeLogo } from "@/components/zhebe-logo";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

interface NavItem {
  titleKey: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const userNavigation: NavItem[] = [
  { titleKey: "nav.templates", url: "/templates", icon: FolderOpenIcon },
  { titleKey: "nav.documents", url: "/documents", icon: FilesIcon },
  // Временно скрыто: команда
  // { titleKey: "nav.team", url: "/team", icon: UsersIcon },
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

// Collapsed (icon) state: square button, centered in the rail (the row is
// wider than the button, so without mx-auto it sticks to the left and sits
// off-center vs the header toggle), centered icon, label hidden.
const COLLAPSED_ICON =
  "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>span:last-child]:hidden";

// Active item from the design: mauve brand tint (rgba(221,205,213,0.7)) with
// brand-colored icon + label.
const ACTIVE_ITEM =
  "data-active:bg-[#ddcdd5]/70 data-active:text-primary data-active:hover:bg-[#ddcdd5]/70";

const MONTHS_RU_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

// Квоты почти исчерпаны — подсвечиваем счётчик и шкалу оранжевым.
const USAGE_WARN_RATIO = 0.8;
// Штриховая шкала: 2px штрих + 4px промежуток, как в макете.
const TICK_PATTERN = "0 2px, transparent 2px 6px";
const AMBER = "#e09026";

function UsageMeter({
  label,
  used,
  quota,
}: {
  label: string;
  used: number;
  quota: number;
}) {
  const unlimited = quota === -1;
  const ratio = unlimited || quota <= 0 ? 0 : Math.min(1, used / quota);
  const warn = !unlimited && ratio >= USAGE_WARN_RATIO;
  const fillColor = warn ? AMBER : "var(--primary)";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-sidebar-foreground">{label}</span>
        <span className={warn ? "text-[#e09026]" : "text-sidebar-foreground"}>
          {used}/{unlimited ? "∞" : quota}
        </span>
      </div>
      {/* Серая штриховая подложка + закрашенная часть тем же паттерном сверху */}
      <div className="relative h-2">
        <div
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(90deg, var(--border) ${TICK_PATTERN})`,
          }}
        />
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${ratio * 100}%`,
            background: `repeating-linear-gradient(90deg, ${fillColor} ${TICK_PATTERN})`,
          }}
        />
      </div>
    </div>
  );
}

/** Карточка «Использование» внизу сайдбара: месячные квоты тарифа. */
function SidebarUsageCard() {
  const { data: session } = authClient.useSession();
  const trpc = useTRPC();
  const { data: sub } = useQuery({
    ...trpc.subscriptions.mySubscription.queryOptions(),
    enabled: Boolean(session),
  });

  if (!sub || (sub.downloadQuota === 0 && sub.editQuota === 0)) {
    return null;
  }

  // Квоты месячные (periodKey = календарный месяц) — сброс 1-го числа.
  const now = new Date();
  const reset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetLabel = `Обновится ${reset.getDate()} ${MONTHS_RU_GENITIVE[reset.getMonth()]}`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 group-data-[collapsible=icon]:hidden">
      <div className="flex flex-col gap-0.5">
        <p className="font-medium text-sidebar-foreground text-sm">
          Использование
        </p>
        <p className="text-muted-foreground text-xs">{resetLabel}</p>
      </div>
      <UsageMeter
        label="Шаблоны"
        quota={sub.downloadQuota}
        used={sub.downloadsUsed}
      />
      <UsageMeter
        label="Редактирование"
        quota={sub.editQuota}
        used={sub.editsUsed}
      />
    </div>
  );
}

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
  const { t } = useTranslation();
  const isAdminContext = location.pathname.startsWith("/admin");
  const navigation = isAdminContext ? adminNavigation : userNavigation;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-[54px] flex-row items-center justify-between px-4 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <Link
          aria-label={isAdminContext ? "ZHEBE · Админка" : "ZHEBE"}
          className="text-sidebar-foreground group-data-[collapsible=icon]:hidden"
          to={isAdminContext ? "/admin/templates" : "/"}
        >
          <ZhebeLogo className="h-5 w-auto" />
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
      {/* В свёрнутом (иконочном) режиме нижняя панель не показывается */}
      <SidebarFooter className="gap-2 group-data-[collapsible=icon]:hidden">
        {!isAdminContext && <SidebarUsageCard />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
