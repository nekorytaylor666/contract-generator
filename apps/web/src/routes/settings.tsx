import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { requireAuth } from "@/lib/auth-guard";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  beforeLoad: async () => {
    const { session } = await requireAuth();
    return { session };
  },
});

// Organization deletion is postponed product-wise — the button and its
// confirm dialog were removed on 15.07.2026 (restore from git history when
// the flow is ready).
function SettingsPage() {
  const { data: organizations } = authClient.useListOrganizations();
  const { data: activeOrg } = authClient.useActiveOrganization();

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="border-b px-6 py-4">
        <h1 className="font-semibold text-lg">Настройки</h1>
      </div>

      <div className="flex flex-col gap-6 p-6">
        <section>
          <h2 className="mb-3 font-medium text-sm">Организации</h2>
          <div className="flex flex-col gap-2">
            {organizations?.length === 0 && (
              <p className="text-muted-foreground text-sm">
                У вас нет организаций
              </p>
            )}
            {organizations?.map((org) => (
              <div
                className="flex items-center justify-between rounded-lg border bg-card p-4"
                key={org.id}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md border">
                    <Building2 className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{org.name}</span>
                      {activeOrg?.id === org.id && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
                          активная
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">{org.slug}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
