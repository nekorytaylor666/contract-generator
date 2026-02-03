import { Building2, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";

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

export function OrganizationSwitcher() {
  const { isMobile } = useSidebar();
  const { data: organizations, isPending: isLoadingOrgs } =
    authClient.useListOrganizations();
  const { data: activeOrg, isPending: isLoadingActiveOrg } =
    authClient.useActiveOrganization();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [orgName, setOrgName] = useState("");

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

  if (isLoadingOrgs || isLoadingActiveOrg) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-16" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                size="lg"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {activeOrg?.name ?? "Select Organization"}
                  </span>
                  <span className="truncate text-muted-foreground text-xs">
                    {activeOrg?.slug ?? "No organization selected"}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Organizations
              </DropdownMenuLabel>
              {organizations?.map((org) => (
                <DropdownMenuItem
                  className="gap-2 p-2"
                  key={org.id}
                  onClick={() => handleSwitchOrganization(org.id)}
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    <Building2 className="size-4 shrink-0" />
                  </div>
                  <span className="truncate">{org.name}</span>
                  {activeOrg?.id === org.id && (
                    <span className="ml-auto text-muted-foreground text-xs">
                      Active
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
              {(!organizations || organizations.length === 0) && (
                <DropdownMenuItem className="text-muted-foreground" disabled>
                  No organizations yet
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={() => setIsDialogOpen(true)}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Plus className="size-4" />
                </div>
                <span className="font-medium text-muted-foreground">
                  Create Organization
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to collaborate with your team.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Organization Name</Label>
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
              Cancel
            </Button>
            <Button
              disabled={isCreating || !orgName.trim()}
              onClick={handleCreateOrganization}
            >
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
