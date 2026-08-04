import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  formatTenge,
  InfoRow,
  MODAL_POLL_INTERVAL_MS,
  OUTLINE_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  parseInvIdFromPaymentUrl,
  StatusView,
} from "@/components/template-modal-shared";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clearDownloadReturn,
  type InitialPayment,
  saveDownloadReturn,
} from "@/lib/download-return";
import { useTRPC } from "@/utils/trpc";

// Шаги модалки «Редактирование договора» (по макетам «Разовый» и «Подписка»):
// сводка стоимости, платёжные статусы Робокассы (когда квота не покрывает) и
// создание копии договора (creating → created / createFailed).
type Step =
  | "info"
  | "redirect"
  | "checking"
  | "failed"
  | "unavailable"
  | "success"
  | "creating"
  | "created"
  | "createFailed";

// Стартовый шаг: обычное открытие — сводка стоимости; возврат с оплаты —
// сразу «Проверяем оплату» либо «Не удалось провести оплату».
function initialStepFor(payment: InitialPayment | null | undefined): Step {
  if (!payment) {
    return "info";
  }
  if (payment.failed || payment.invId == null) {
    return "failed";
  }
  return "checking";
}

/** Шаг сводки. «Разовый» тариф (по его макету): стоимость, экономия по
 * тарифу, остаток квоты, итог и кнопка «Тарифы». Платная подписка (по макету
 * «Подписка»): только стоимость и остаток квоты, одна кнопка «Перейти к
 * редактированию». */
function EditInfoStep({
  templateTitle,
  price,
  hasEdit,
  covered,
  isPaidPlan,
  quota,
  remaining,
  unlimited,
  total,
  busy,
  onPlans,
  onPrimary,
}: {
  templateTitle: string;
  price: number;
  hasEdit: boolean;
  covered: boolean;
  isPaidPlan: boolean;
  quota: number;
  remaining: number;
  unlimited: boolean;
  total: number;
  busy: boolean;
  onPlans: () => void;
  onPrimary: () => void;
}) {
  const { t } = useTranslation();

  let costValue = formatTenge(price);
  if (hasEdit) {
    costValue = t("downloadDialog.costPurchased");
  } else if (price === 0) {
    costValue = t("downloadDialog.costFree");
  }
  // «Экономия с подпиской» и «Итого» — атрибуты флоу «Разового» тарифа; у
  // платной подписки в макете их нет (покрытие и так очевидно).
  const showSavings = covered && !hasEdit && price > 0 && !isPaidPlan;
  const showTotal = !isPaidPlan;
  const showQuotaRow = quota !== 0 && !hasEdit;
  const quotaValue = unlimited
    ? t("downloadDialog.downloadsUnlimited")
    : t("editDialog.editsLeft", { count: remaining, total: quota });
  const showPlansButton = !(isPaidPlan && covered);
  // У подписки кнопка одна и широкая — длинный лейбл по макету; у «Разового»
  // рядом «Тарифы», длинный текст в 320px не помещается.
  let primaryLabel = t("downloadDialog.goToPayment");
  if (covered) {
    primaryLabel = isPaidPlan
      ? t("editDialog.goToEditor")
      : t("templates.edit");
  }

  return (
    <>
      <div className="flex flex-col gap-3 px-4 py-2">
        <h2 className="font-semibold text-foreground text-xl leading-6">
          {templateTitle}
        </h2>
        <div className="text-sm leading-[18px]">
          <InfoRow label={t("downloadDialog.cost")} value={costValue} />
          {showSavings && (
            <InfoRow
              label={t("editDialog.savings")}
              value={`−${formatTenge(price)}`}
              valueClassName="text-[#9e1f5a]"
            />
          )}
          {showQuotaRow && (
            <InfoRow
              label={t("editDialog.editsRow")}
              value={quotaValue}
              valueClassName={
                remaining === 0 && !unlimited ? "text-[#ef4444]" : ""
              }
              withBottomBorder={showTotal}
            />
          )}
          {showTotal && (
            <InfoRow label={t("editDialog.total")} value={formatTenge(total)} />
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 p-4">
        {showPlansButton && (
          <button
            className={OUTLINE_BUTTON_CLASS}
            disabled={busy}
            onClick={onPlans}
            type="button"
          >
            {t("editDialog.plans")}
          </button>
        )}
        <button
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy}
          onClick={onPrimary}
          type="button"
        >
          {primaryLabel}
        </button>
      </div>
    </>
  );
}

/**
 * Модалка «Редактирование договора» (по макету): для пользователя без платной
 * подписки показывает стоимость разовой покупки, экономию по тарифу (когда
 * редактирование покрыто квотой), остаток квоты и итог. Оплата через Робокассу
 * не покидает флоу — статусы «Переходим к оплате», «Проверяем оплату»,
 * ошибка/успех показываются внутри модалки; успех ведёт в конструктор.
 */
export function TemplateEditDialog({
  templateId,
  templateTitle,
  price,
  open,
  onOpenChange,
  initialPayment,
}: {
  templateId: string;
  templateTitle: string;
  price: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPayment?: InitialPayment | null;
}) {
  const { t } = useTranslation();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(() => initialStepFor(initialPayment));
  const [checkingInvId, setCheckingInvId] = useState<number | null>(() =>
    initialPayment && !initialPayment.failed ? initialPayment.invId : null
  );

  const { data: purchases = [] } = useQuery({
    ...trpc.payments.myPurchases.queryOptions(),
    enabled: open,
  });
  const { data: sub } = useQuery({
    ...trpc.subscriptions.mySubscription.queryOptions(),
    enabled: open,
  });

  // Опрос статуса платежа после возврата с Робокассы — как на /success/payment.
  const { data: payStatus } = useQuery({
    ...trpc.payments.getByInvId.queryOptions({ invId: checkingInvId ?? 0 }),
    enabled: open && step === "checking" && checkingInvId != null,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? MODAL_POLL_INTERVAL_MS : false,
  });

  const hasEdit = purchases.some(
    (p) => p.templateId === templateId && p.kind === "edit"
  );
  const quota = sub?.editQuota ?? 0;
  const remaining = sub?.editRemaining ?? 0;
  const unlimited = quota === -1 || remaining === -1;
  // Редактирование покрыто: куплено, бесплатно или есть квота тарифа.
  const covered = hasEdit || price === 0 || unlimited || remaining > 0;
  const total = covered ? 0 : price;

  const invalidateAccess = () => {
    queryClient.invalidateQueries(
      trpc.subscriptions.mySubscription.queryFilter()
    );
    queryClient.invalidateQueries({
      queryKey: trpc.payments.myPurchases.queryKey(),
    });
    queryClient.invalidateQueries({ queryKey: trpc.documents.list.queryKey() });
  };

  const goToBuilder = (documentId?: string) => {
    onOpenChange(false);
    navigate({
      to: "/templates/$templateId/builder",
      params: { templateId },
      search: documentId ? { documentId } : {},
    });
  };

  // Покрытое редактирование: создаём черновик (он появляется в «Моих
  // документах») на экране «Подготавливаем договор…», затем показываем
  // «Договор готов к редактированию» с переходом в конструктор.
  const [createdDocId, setCreatedDocId] = useState<string | null>(null);
  const createDraftMutation = useMutation(
    trpc.documents.save.mutationOptions({
      onSuccess: (data) => {
        invalidateAccess();
        setCreatedDocId(data.id);
        setStep("created");
      },
      onError: (err) => {
        setStep("createFailed");
        toast.error(err.message);
      },
    })
  );

  const startDraftCreation = () => {
    setStep("creating");
    createDraftMutation.mutate({
      templateId,
      title: templateTitle,
      variables: {},
    });
  };

  const checkoutMutation = useMutation(
    trpc.payments.createTemplateCheckout.mutationOptions({
      onSuccess: (result) => {
        if (result.alreadyPurchased) {
          invalidateAccess();
          startDraftCreation();
          return;
        }
        saveDownloadReturn({
          templateId,
          invId: parseInvIdFromPaymentUrl(result.url),
          format: "pdf",
          flow: "edit",
        });
        window.location.href = result.url;
      },
      onError: () => setStep("unavailable"),
    })
  );

  const startPurchase = () => {
    setStep("redirect");
    checkoutMutation.mutate({ templateId, kind: "edit" });
  };

  // Возврат с Робокассы: контекст одноразовый, чистим его. Эффект срабатывает
  // один раз на маунт (initialPayment фиксируется страницей при загрузке).
  useEffect(() => {
    if (initialPayment) {
      clearDownloadReturn();
    }
  }, [initialPayment]);

  // Повторное открытие модалки (после закрытия) начинается со сводки.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStep("info");
      setCheckingInvId(null);
    }
    wasOpenRef.current = open;
  }, [open]);

  // Платёж подтверждён вебхуком: доступ выдан, черновик создан на сервере —
  // обновляем кэш и показываем экран успеха. invalidateAccess стабилен по
  // смыслу — эффект должен срабатывать только на смену статуса платежа.
  // biome-ignore lint/correctness/useExhaustiveDependencies: см. выше
  useEffect(() => {
    if (step !== "checking" || !payStatus) {
      return;
    }
    if (payStatus.status === "paid") {
      invalidateAccess();
      setStep("success");
      return;
    }
    if (payStatus.status !== "pending") {
      setStep("failed");
    }
  }, [payStatus?.status, step]);

  const busy = checkoutMutation.isPending || createDraftMutation.isPending;

  const handlePrimaryAction = () => {
    if (total === 0) {
      startDraftCreation();
      return;
    }
    startPurchase();
  };

  const handlePlansClick = () => {
    onOpenChange(false);
    navigate({ to: "/profile", search: { tab: "subscription" } });
  };

  const headerTitle =
    step === "info" ? t("editDialog.title") : t("editDialog.actionTitle");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex flex-col gap-0 overflow-hidden rounded-[10px] border-[#e5e5e5] p-0 sm:max-w-[320px]"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between border-[#e5e5e5] border-b p-4">
          <DialogTitle className="font-medium text-base leading-5">
            {headerTitle}
          </DialogTitle>
          <DialogClose
            aria-label={t("downloadDialog.close")}
            className="flex size-6 items-center justify-center rounded-md text-foreground outline-none hover:bg-muted"
          >
            <X className="size-4" />
          </DialogClose>
        </DialogHeader>

        {step === "info" && (
          <EditInfoStep
            busy={busy}
            covered={covered}
            hasEdit={hasEdit}
            isPaidPlan={Boolean(sub?.isPaid)}
            onPlans={handlePlansClick}
            onPrimary={handlePrimaryAction}
            price={price}
            quota={quota}
            remaining={remaining}
            templateTitle={templateTitle}
            total={total}
            unlimited={unlimited}
          />
        )}

        {step === "creating" && (
          <StatusView
            hint={t("editDialog.preparingHint")}
            title={t("editDialog.preparingTitle")}
            tone="checking"
          />
        )}

        {step === "created" && (
          <StatusView
            action={{
              label: t("editDialog.goToEditor"),
              icon: "edit",
              onClick: () => goToBuilder(createdDocId ?? undefined),
            }}
            hint={t("editDialog.readyHint")}
            title={t("editDialog.readyTitle")}
            tone="success"
          />
        )}

        {step === "createFailed" && (
          <StatusView
            action={{
              label: t("downloadDialog.retry"),
              disabled: busy,
              onClick: startDraftCreation,
            }}
            hint={t("editDialog.createFailedHint")}
            title={t("editDialog.createFailedTitle")}
            tone="failed"
          />
        )}

        {step === "redirect" && (
          <StatusView
            hint={t("downloadDialog.redirectHint")}
            title={t("downloadDialog.redirectTitle")}
            tone="redirect"
          />
        )}

        {step === "checking" && (
          <StatusView
            hint={t("downloadDialog.checkingHint")}
            title={t("downloadDialog.checkingTitle")}
            tone="checking"
          />
        )}

        {step === "failed" && (
          <StatusView
            action={{
              label: t("downloadDialog.retry"),
              disabled: busy,
              onClick: startPurchase,
            }}
            hint={t("downloadDialog.failedHint")}
            title={t("downloadDialog.failedTitle")}
            tone="failed"
          />
        )}

        {step === "unavailable" && (
          <StatusView
            action={{
              label: t("downloadDialog.retryAttempt"),
              disabled: busy,
              onClick: startPurchase,
            }}
            hint={t("downloadDialog.unavailableHint")}
            title={t("downloadDialog.unavailableTitle")}
            tone="failed"
          />
        )}

        {step === "success" && (
          <StatusView
            action={{
              label: t("editDialog.goToEditor"),
              onClick: () => goToBuilder(payStatus?.documentId ?? undefined),
            }}
            hint={t("editDialog.successHint")}
            title={t("editDialog.successTitle")}
            tone="success"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
