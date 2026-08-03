import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/utils/trpc";

const MONTHS_RU = [
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

function formatDate(value: Date | string): string {
  const d = new Date(value);
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}, ${d.getFullYear()}`;
}

const PERIOD_LABELS: Record<string, string> = {
  monthly: "Ежемесячный",
  quarterly: "Квартальный",
  yearly: "Годовой",
};

// «2 из 10»; безлимит показываем как ∞.
function quotaLine(remaining: number, quota: number): string {
  if (quota === -1) {
    return "∞";
  }
  return `${remaining} из ${quota}`;
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
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100">
        <Check className="size-6 text-emerald-600" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-base text-foreground">
          Вы успешно отменили подписку!
        </p>
        <p className="max-w-[260px] text-muted-foreground text-sm">
          Ваша подписка будет активна до конца периода активации.
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
        toast.success("Подписка восстановлена");
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const cancelled = Boolean(my?.cancelledAt);
  const pending = cancelMut.isPending || restoreMut.isPending;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Подписка</DialogTitle>
        </DialogHeader>

        {showCancelled && <CancelledContent />}

        {!showCancelled && my && (
          <div className="rounded-xl border border-border">
            <Row label="Текущий тариф" value={my.planName ?? "Разовый"} />
            <Row
              label="Осталось загрузок"
              value={quotaLine(my.downloadRemaining, my.downloadQuota)}
            />
            <Row
              label="Осталось редактирований"
              value={quotaLine(my.editRemaining, my.editQuota)}
            />
            {checksQuota !== 0 && (
              <Row
                label="Осталось проверок документов"
                value={quotaLine(checksQuota, checksQuota)}
              />
            )}
            {my.isPaid && (
              <Row
                label="Стоимость тарифа"
                value={`${my.price.toLocaleString("ru-RU")} ₸`}
              />
            )}
            {my.isPaid && my.expiresAt && (
              <Row label="Активна до" value={formatDate(my.expiresAt)} />
            )}
            {my.isPaid && my.period && (
              <Row
                label="Период подписки"
                value={PERIOD_LABELS[my.period] ?? my.period}
              />
            )}
          </div>
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
                    Восстанавливаем
                    <LoaderCircle className="size-4 animate-spin" />
                  </>
                ) : (
                  "Восстановить подписку"
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
                    Отменяем
                    <LoaderCircle className="size-4 animate-spin" />
                  </>
                ) : (
                  "Отменить подписку"
                )}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
