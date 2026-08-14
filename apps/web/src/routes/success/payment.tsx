import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Download, Loader2, Pencil } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startFileDownload } from "@/lib/download-file";
import { readDownloadReturn } from "@/lib/download-return";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/success/payment")({
  component: PaymentSuccess,
  validateSearch: (search: Record<string, unknown>): { invId?: number } => {
    // Accept both our normalized `invId` and Robokassa's raw `InvId` (when the
    // cabinet SuccessURL points straight at the SPA instead of via our server).
    const raw = search.invId ?? search.InvId;
    if (raw == null || raw === "") {
      return { invId: undefined };
    }
    const parsed = Number(raw);
    return { invId: Number.isNaN(parsed) ? undefined : parsed };
  },
});

const POLL_INTERVAL_MS = 2000;

function PaymentSuccess() {
  const { t } = useTranslation();
  const { invId } = Route.useSearch();
  const trpc = useTRPC();
  const navigate = useNavigate();

  // Платёж начат из модалки скачивания на странице шаблона — возвращаем
  // пользователя туда: модалка откроется в состоянии «Проверяем оплату» и
  // сама доведёт флоу до скачивания (см. TemplateDownloadDialog).
  useEffect(() => {
    if (invId == null) {
      return;
    }
    const stored = readDownloadReturn();
    if (!stored || (stored.invId != null && stored.invId !== invId)) {
      return;
    }
    navigate({
      to: "/templates/$templateId",
      params: { templateId: stored.templateId },
      search: { payInvId: invId },
      replace: true,
    });
  }, [invId, navigate]);

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
        startFileDownload(result.downloadPath);
      },
      onError: (error) => toast.error(error.message),
    })
  );

  const paid = data?.status === "paid";
  const templateId = data?.templateId ?? null;
  // Черновик, созданный вебхуком при подтверждении оплаты, — редактор
  // открывается на нём, а не плодит второй документ.
  const documentId = data?.documentId ?? null;
  const isDownload = data?.purpose === "template_download";
  const isSubscription = data?.purpose === "subscription";

  const queryClient = useQueryClient();
  // Оплата подтверждена вебхуком: тариф/квоты изменились на сервере, а SPA
  // не перезагружалась — сбрасываем кэш, иначе виджет «Использование» и
  // профиль показывают старые данные до ручного обновления страницы.
  useEffect(() => {
    if (paid) {
      queryClient.invalidateQueries(
        trpc.subscriptions.mySubscription.queryFilter()
      );
    }
  }, [paid, queryClient, trpc]);
  // A paid subscription shows its success as a modal on the profile tab.
  useEffect(() => {
    if (paid && isSubscription) {
      navigate({
        to: "/profile",
        search: { tab: "subscription", subscribed: true },
        replace: true,
      });
    }
  }, [paid, isSubscription, navigate]);

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
              <Link
                params={{ templateId }}
                search={documentId ? { documentId } : {}}
                to="/templates/$templateId/builder"
              >
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
