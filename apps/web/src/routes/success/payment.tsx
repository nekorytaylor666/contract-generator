import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Download, Loader2, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

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

  const downloadMutation = useMutation(
    trpc.templates.downloadPurchased.mutationOptions({
      onSuccess: (result) => {
        const link = document.createElement("a");
        link.href = result.pdfDataUrl;
        link.download = result.fileName;
        link.click();
      },
      onError: (error) => toast.error(error.message),
    })
  );

  const paid = data?.status === "paid";
  const templateId = data?.templateId ?? null;
  const isDownload = data?.purpose === "template_download";
  const isSubscription = data?.purpose === "subscription";

  const paidHint = isSubscription
    ? t("payment.successSubscriptionHint")
    : t("payment.successPaidHint");

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
          {paid ? paidHint : t("payment.successPendingHint")}
        </p>
      </div>

      {/* Access to the purchased document, once payment is confirmed */}
      {paid && templateId && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {isDownload ? (
            <Button
              disabled={downloadMutation.isPending}
              onClick={() => downloadMutation.mutate({ templateId })}
            >
              <Download className="size-4" />
              {t("payment.downloadDoc")}
            </Button>
          ) : (
            <Button asChild>
              <Link params={{ templateId }} to="/templates/$templateId/builder">
                <Pencil className="size-4" />
                {t("payment.openEditor")}
              </Link>
            </Button>
          )}
        </div>
      )}

      {paid && isSubscription && (
        <Button asChild>
          <Link to="/profile">{t("payment.toProfile")}</Link>
        </Button>
      )}

      <Button asChild variant="outline">
        <Link to="/templates">{t("payment.toTemplates")}</Link>
      </Button>
    </div>
  );
}
