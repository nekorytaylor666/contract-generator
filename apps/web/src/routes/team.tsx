import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { requireAuth } from "@/lib/auth-guard";

export const Route = createFileRoute("/team")({
  component: TeamPage,
  beforeLoad: async () => {
    const { session, organizations } = await requireAuth();
    return { session, organizations };
  },
});

function TeamPage() {
  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex flex-col gap-4 p-6">
        <h1 className="font-semibold text-2xl text-foreground leading-7">
          Команда
        </h1>
        <p className="text-muted-foreground text-sm">
          Здесь будут документы, доступные всей команде.
        </p>
        <div className="flex flex-col items-center justify-center py-20">
          <Users className="mb-3 size-12 text-muted-foreground/30" />
          <p className="font-medium text-foreground text-sm">Пока тут пусто</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Доступы и общие документы команды появятся позже
          </p>
        </div>
      </div>
    </div>
  );
}
