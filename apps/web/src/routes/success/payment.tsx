import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/success/payment")({
  component: PaymentSuccess,
  validateSearch: (search: Record<string, unknown>): { invId?: number } => ({
    invId: search.invId ? Number(search.invId) : undefined,
  }),
});

const POLL_INTERVAL_MS = 2000;

function PaymentSuccess() {
  const { t } = useTranslation();
  const { invId } = Route.useSearch();
  const trpc = useTRPC();

  const { data } = useQuery({
    ...trpc.payments.getByInvId.queryOptions({ invId: invId ?? 0 }),
    enabled: invId != null,
    // Poll until the ResultURL webhook flips the status to "paid".
    refetchInterval: (query) =>
      query.state.data?.status === "paid" ? false : POLL_INTERVAL_MS,
  });

  const paid = data?.status === "paid";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      {paid ? (
        <CheckCircle2 className="size-14 text-green-600" />
      ) : (
        <Loader2 className="size-14 animate-spin text-muted-foreground" />
      )}
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-foreground text-xl">
          {paid ? t("payment.successTitle") : t("payment.successPending")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {paid
            ? t("payment.successPaidHint")
            : t("payment.successPendingHint")}
        </p>
      </div>
      <Button asChild>
        <Link to="/templates">{t("payment.toTemplates")}</Link>
      </Button>
    </div>
  );
}
