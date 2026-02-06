import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, Check, LogOut, Plus, User } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

export function NavUser() {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const { data: organizations, isPending: isLoadingOrgs } =
    authClient.useListOrganizations();
  const { data: activeOrg, isPending: isLoadingActiveOrg } =
    authClient.useActiveOrganization();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [orgName, setOrgName] = useState("");

  const isPending = isSessionPending || isLoadingOrgs || isLoadingActiveOrg;

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) {
      return;
    }

    setIsCreating(true);
    await authClient.organization.create({
      name: orgName,
      slug: orgName.toLowerCase().replace(/\s+/g, "-"),
    });
    setIsCreating(false);
    setIsDialogOpen(false);
    setOrgName("");
  };

  const handleSwitchOrganization = async (organizationId: string) => {
    await authClient.organization.setActive({
      organizationId,
    });
  };

  if (isPending) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton className="h-14" size="lg">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-16" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!session) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild className="h-14" size="lg">
            <Link to="/login">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <User className="size-5" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Войти</span>
                <span className="truncate text-muted-foreground text-xs">
                  Доступ к аккаунту
                </span>
              </div>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate({ to: "/" });
        },
      },
    });
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                className="h-14 rounded-lg bg-muted/50 data-open:bg-muted"
                size="lg"
              >
                <Avatar className="size-10">
                  <AvatarImage src={session.user.image ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {session.user.name?.charAt(0).toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {session.user.name}
                  </span>
                  <span className="truncate text-muted-foreground text-xs">
                    Мой профиль
                  </span>
                </div>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              side={isMobile ? "top" : "top"}
              sideOffset={8}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-3 px-2 py-2 text-left text-sm">
                  <Avatar className="size-10">
                    <AvatarImage src={session.user.image ?? undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {session.user.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {session.user.name}
                    </span>
                    <span className="truncate text-muted-foreground text-xs">
                      {session.user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Organization Section */}
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Организации
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                {organizations?.map((org) => (
                  <DropdownMenuItem
                    className="gap-2"
                    key={org.id}
                    onClick={() => handleSwitchOrganization(org.id)}
                  >
                    <div className="flex size-6 items-center justify-center rounded-sm border">
                      <Building2 className="size-3.5" />
                    </div>
                    <span className="flex-1 truncate">{org.name}</span>
                    {activeOrg?.id === org.id && (
                      <Check className="size-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
                {(!organizations || organizations.length === 0) && (
                  <DropdownMenuItem className="text-muted-foreground" disabled>
                    Нет организаций
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border border-dashed">
                    <Plus className="size-3.5" />
                  </div>
                  <span className="text-muted-foreground">
                    Создать организацию
                  </span>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={handleSignOut} variant="destructive">
                  <LogOut className="mr-2 size-4" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать организацию</DialogTitle>
            <DialogDescription>
              Создайте новую организацию для совместной работы с командой.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Название организации</Label>
              <Input
                id="name"
                onChange={(e) => setOrgName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateOrganization();
                  }
                }}
                placeholder="Acme Inc."
                value={orgName}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsDialogOpen(false)} variant="outline">
              Отмена
            </Button>
            <Button
              disabled={isCreating || !orgName.trim()}
              onClick={handleCreateOrganization}
            >
              {isCreating ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
