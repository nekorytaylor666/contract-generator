import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { Check, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { planDisplayName } from "@/components/plans-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatQuotaResetDate } from "@/lib/quota-period";
import { useTRPC } from "@/utils/trpc";

// «21 сентября, 2026» — название месяца берём из переводов (subscription.months).
function formatDate(value: Date | string, t: TFunction): string {
  const d = new Date(value);
  return t("subscription.dateFormat", {
    day: d.getDate(),
    month: t(`subscription.months.${d.getMonth()}`),
    year: d.getFullYear(),
  });
}

const PERIOD_LABEL_KEYS: Record<string, string> = {
  monthly: "subscription.periods.monthly",
  quarterly: "subscription.periods.quarterly",
  yearly: "subscription.periods.yearly",
};

// «2 из 10»; безлимит показываем как ∞.
function quotaLine(remaining: number, quota: number, t: TFunction): string {
  if (quota === -1) {
    return "∞";
  }
  return t("subscription.quotaOf", { remaining, quota });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-3 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-right font-medium text-foreground text-sm">
        {value}
      </span>
    </div>
  );
}

function CancelledContent() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100">
        <Check className="size-6 text-emerald-600" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-base text-foreground">
          {t("subscription.cancelledTitle")}
        </p>
        <p className="max-w-[260px] text-muted-foreground text-sm">
          {t("subscription.cancelledDescription")}
        </p>
      </div>
    </div>
  );
}

interface SubscriptionManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Квота «Проверка документов» из фич тарифа (0 — строка скрыта). */
  checksQuota: number;
}

/**
 * Модалка «Подписка» (макет 09_Profile/Subscription): детали тарифа и
 * остатки квот, «Отменить подписку» → экран успеха → «Восстановить».
 * Автосписаний нет, отмена — пометка «не продлевать»: доступ сохраняется
 * до конца оплаченного периода.
 */
export function SubscriptionManageDialog({
  open,
  onOpenChange,
  checksQuota,
}: SubscriptionManageDialogProps) {
  const { t, i18n } = useTranslation();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: my } = useQuery(
    trpc.subscriptions.mySubscription.queryOptions()
  );
  const [showCancelled, setShowCancelled] = useState(false);

  // Сбрасываем экран успеха при закрытии, а не при открытии: эффект на open
  // срабатывал бы после рендера и первый кадр показывал бы старый экран.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setShowCancelled(false);
    }
    onOpenChange(next);
  };

  const invalidate = () =>
    queryClient.invalidateQueries(
      trpc.subscriptions.mySubscription.queryFilter()
    );

  const cancelMut = useMutation(
    trpc.subscriptions.cancel.mutationOptions({
      onSuccess: () => {
        invalidate();
        setShowCancelled(true);
      },
      onError: (err) => toast.error(err.message),
    })
  );
  const restoreMut = useMutation(
    trpc.subscriptions.restore.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success(t("subscription.restored"));
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const cancelled = Boolean(my?.cancelledAt);
  const pending = cancelMut.isPending || restoreMut.isPending;
  const periodLabelKey = my?.period ? PERIOD_LABEL_KEYS[my.period] : undefined;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t("subscription.title")}</DialogTitle>
        </DialogHeader>

        {showCancelled && <CancelledContent />}

        {!showCancelled && my && (
          <div className="rounded-xl border border-border">
            <Row
              label={t("subscription.currentPlan")}
              value={
                planDisplayName(my, i18n.language) ??
                t("subscription.oneTimePlan")
              }
            />
            <Row
              label={t("subscription.downloadsLeft")}
              value={quotaLine(my.downloadRemaining, my.downloadQuota, t)}
            />
            <Row
              label={t("subscription.editsLeft")}
              value={quotaLine(my.editRemaining, my.editQuota, t)}
            />
            {checksQuota !== 0 && (
              <Row
                label={t("subscription.checksLeft")}
                value={quotaLine(checksQuota, checksQuota, t)}
              />
            )}
            {my.isPaid && (
              <Row
                label={t("subscription.planPrice")}
                value={t("subscription.priceValue", {
                  price: my.price.toLocaleString("ru-RU"),
                })}
              />
            )}
            {my.isPaid && my.expiresAt && (
              <Row
                label={t("subscription.activeUntil")}
                value={formatDate(my.expiresAt, t)}
              />
            )}
            {my.isPaid && my.period && (
              <Row
                label={t("subscription.periodLabel")}
                value={periodLabelKey ? t(periodLabelKey) : my.period}
              />
            )}
          </div>
        )}

        {!showCancelled && my && (
          <p className="px-1 text-muted-foreground text-xs">
            {t("subscription.resetNote", {
              date: formatQuotaResetDate(i18n.language, my.quotaResetAt),
            })}
          </p>
        )}

        {my?.isPaid && my.expiresAt && (
          <DialogFooter>
            {showCancelled || cancelled ? (
              <Button
                className="h-9 px-4 text-sm"
                disabled={pending}
                onClick={() => restoreMut.mutate()}
                type="button"
              >
                {restoreMut.isPending ? (
                  <>
                    {t("subscription.restoring")}
                    <LoaderCircle className="size-4 animate-spin" />
                  </>
                ) : (
                  t("subscription.restore")
                )}
              </Button>
            ) : (
              <Button
                className="h-9 bg-destructive px-4 text-sm text-white hover:bg-destructive/90"
                disabled={pending}
                onClick={() => cancelMut.mutate()}
                type="button"
              >
                {cancelMut.isPending ? (
                  <>
                    {t("subscription.cancelling")}
                    <LoaderCircle className="size-4 animate-spin" />
                  </>
                ) : (
                  t("subscription.cancel")
                )}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
