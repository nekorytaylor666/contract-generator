import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/accept-invitation/$invitationId/")({
  component: AcceptInvitationPage,
});

const ACCESS_LABELS: Record<string, string> = {
  full: "Полный доступ",
  view: "Просмотр",
};

function unusableReason(status: string, expired: boolean): string | null {
  if (status !== "pending") {
    return "Это приглашение уже использовано.";
  }
  if (expired) {
    return "Срок действия приглашения истёк.";
  }
  return null;
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted px-4 py-8 sm:px-6">
      <main
        className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl bg-background p-6 text-center sm:p-8"
        style={{ boxShadow: "0px 25px 50px 0 rgba(0,0,0,0.1)" }}
      >
        {children}
      </main>
    </div>
  );
}

function AcceptInvitationPage() {
  const { invitationId } = Route.useParams();
  const navigate = useNavigate();
  const trpc = useTRPC();

  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { data: invite, isPending: inviteLoading } = useQuery(
    trpc.team.getInvite.queryOptions({ invitationId })
  );
  const accept = useMutation(
    trpc.team.acceptInvite.mutationOptions({
      onSuccess: () => {
        toast.success("Приглашение принято");
        navigate({ to: "/dashboard" });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  if (inviteLoading || sessionPending) {
    return (
      <CenteredCard>
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
      </CenteredCard>
    );
  }

  if (!invite) {
    return (
      <CenteredCard>
        <h1 className="font-semibold text-foreground text-xl">
          Приглашение не найдено
        </h1>
        <p className="text-muted-foreground text-sm">
          Ссылка недействительна или была отозвана.
        </p>
        <Button asChild variant="outline">
          <Link to="/">На главную</Link>
        </Button>
      </CenteredCard>
    );
  }

  const unusable = unusableReason(invite.status, invite.expired);
  if (unusable) {
    return (
      <CenteredCard>
        <h1 className="font-semibold text-foreground text-xl">
          Приглашение недоступно
        </h1>
        <p className="text-muted-foreground text-sm">{unusable}</p>
        <Button asChild variant="outline">
          <Link to="/">На главную</Link>
        </Button>
      </CenteredCard>
    );
  }

  const accessLabel = ACCESS_LABELS[invite.accessLevel] ?? invite.accessLevel;
  const userEmail = session?.user?.email?.toLowerCase();
  const emailMatches = Boolean(
    userEmail && userEmail === invite.email.toLowerCase()
  );

  return (
    <CenteredCard>
      <h1 className="font-semibold text-foreground text-xl">
        Приглашение в команду «{invite.orgName}»
      </h1>
      <p className="text-muted-foreground text-sm">
        Приглашение для <span className="font-medium">{invite.email}</span>.
        Уровень доступа: {accessLabel}.
      </p>

      {session && emailMatches && (
        <Button
          className="w-full"
          disabled={accept.isPending}
          onClick={() => accept.mutate({ invitationId })}
        >
          {accept.isPending ? "Принимаем…" : "Принять приглашение"}
        </Button>
      )}

      {session && !emailMatches && (
        <>
          <p className="text-destructive text-sm">
            Вы вошли как {session.user.email ?? "другой аккаунт"}. Приглашение
            выписано на {invite.email} — войдите под этим адресом.
          </p>
          <Button
            className="w-full"
            onClick={async () => {
              await authClient.signOut();
              navigate({ to: "/login" });
            }}
            variant="outline"
          >
            Выйти и сменить аккаунт
          </Button>
        </>
      )}

      {!session && (
        <>
          <p className="text-muted-foreground text-sm">
            Чтобы принять приглашение, войдите или зарегистрируйтесь под адресом{" "}
            <span className="font-medium">{invite.email}</span>, затем снова
            откройте ссылку из письма.
          </p>
          <Button asChild className="w-full">
            <Link to="/login">Войти или зарегистрироваться</Link>
          </Button>
        </>
      )}
    </CenteredCard>
  );
}
