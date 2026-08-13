import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { DbPlan, PeriodKey } from "@/components/plans-picker";
import {
  ChoiceCard,
  formatTenge,
  InfoRow,
  MODAL_POLL_INTERVAL_MS,
  PlansDialogStep,
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
  type DownloadReturnFlow,
  type InitialPayment,
  readDownloadReturn,
  saveDownloadReturn,
} from "@/lib/download-return";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

// Шаги модалки «Редактирование договора»: сводка стоимости, экран исчерпанного
// лимита с выбором «разовая покупка / повысить тариф», выбор нового тарифа,
// платёжные статусы Робокассы и создание копии договора
// (creating → created / createFailed).
type Step =
  | "info"
  | "limit"
  | "plans"
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

// Заголовок модалки: сводка — «Редактирование договора», попап тарифов —
// «Тарифы», ветка апгрейда — «Повышение тарифа», остальное — «Редактировать
// договор».
function headerTitleKey(step: Step, upgradeContext: boolean): string {
  if (step === "plans") {
    return "editDialog.plans";
  }
  if (upgradeContext && step !== "info" && step !== "limit") {
    return "downloadDialog.upgradeTitle";
  }
  return step === "info" ? "editDialog.title" : "editDialog.actionTitle";
}

// Ширина модалки: попап «Тарифы» — широкий, экран лимита — средний.
function dialogWidthClass(step: Step): string {
  if (step === "plans") {
    return "sm:max-w-[1000px]";
  }
  if (step === "limit") {
    return "sm:max-w-[450px]";
  }
  return "sm:max-w-[320px]";
}

/** Доступ к редактированию: чем покрыт (покупка/бесплатно/квота) и итог. */
interface EditAccess {
  hasEdit: boolean;
  quota: number;
  remaining: number;
  unlimited: boolean;
  covered: boolean;
  total: number;
}

function computeEditAccess({
  hasEdit,
  price,
  quota,
  remaining,
}: {
  hasEdit: boolean;
  price: number;
  quota: number;
  remaining: number;
}): EditAccess {
  const unlimited = quota === -1 || remaining === -1;
  const covered = hasEdit || price === 0 || unlimited || remaining > 0;
  return {
    hasEdit,
    quota,
    remaining,
    unlimited,
    covered,
    total: covered ? 0 : price,
  };
}

/** Шаг сводки. «Разовый» тариф (по его макету): стоимость, экономия по
 * тарифу, остаток квоты и итог. Платная подписка (по макету «Подписка»):
 * только стоимость и остаток квоты. Одна кнопка: покрыто — в редактирование,
 * лимит исчерпан — «Продолжить» к выбору покупки/тарифа. */
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

  // Покрыто — идём редактировать; исчерпанная квота — «Продолжить» к выбору
  // «разовая покупка / повысить тариф»; тариф вовсе без квоты — сразу оплата.
  let primaryLabel = t("downloadDialog.goToPayment");
  if (covered) {
    primaryLabel = isPaidPlan
      ? t("editDialog.goToEditor")
      : t("templates.edit");
  } else if (quota !== 0) {
    primaryLabel = t("downloadDialog.continue");
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
      <div className="flex justify-end p-4">
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

/** Экран исчерпанного лимита редактирований: иллюстрация, объяснение и выбор
 * пути — разовая покупка или повышение тарифа (как в модалке скачивания). */
function EditLimitStep({
  quota,
  hasUpgradeOption,
  choice,
  onChoose,
  onContinue,
}: {
  quota: number;
  hasUpgradeOption: boolean;
  choice: "buy" | "upgrade" | null;
  onChoose: (choice: "buy" | "upgrade") => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-[#ffe2e2]">
          <X className="size-6 text-[#7f1d1d]" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="font-medium text-foreground text-sm leading-[18px]">
            {t("editDialog.limitTitle")}
          </p>
          <p className="mx-auto max-w-[260px] text-muted-foreground text-sm leading-[18px]">
            {t("editDialog.limitDescription", { count: quota })}
          </p>
        </div>
        <div
          className={cn(
            "grid w-full gap-2",
            hasUpgradeOption && "sm:grid-cols-2"
          )}
        >
          <ChoiceCard
            hint={t("downloadDialog.buyOptionHint")}
            onSelect={() => onChoose("buy")}
            selected={choice === "buy"}
            title={t("editDialog.buyOption")}
          />
          {hasUpgradeOption && (
            <ChoiceCard
              hint={t("editDialog.upgradeOptionHint")}
              onSelect={() => onChoose("upgrade")}
              selected={choice === "upgrade"}
              title={t("downloadDialog.upgradeOption")}
            />
          )}
        </div>
      </div>
      <div className="flex justify-end p-4">
        <button
          className={PRIMARY_BUTTON_CLASS}
          disabled={choice === null}
          onClick={onContinue}
          type="button"
        >
          {t("downloadDialog.continue")}
        </button>
      </div>
    </>
  );
}

/**
 * Модалка «Редактирование договора» (по макету): сводка стоимости с экономией
 * по тарифу; при исчерпанном лимите — разовая покупка или повышение тарифа с
 * оплатой через Робокассу, не покидая флоу; покрытое редактирование создаёт
 * копию договора и ведёт в конструктор.
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
  const [limitChoice, setLimitChoice] = useState<"buy" | "upgrade" | null>(
    null
  );
  // Ветка апгрейда озаглавлена «Повышение тарифа»; разовая покупка остаётся
  // под «Редактировать договор».
  const [upgradeContext, setUpgradeContext] = useState(false);

  const lastFlowRef = useRef<{
    flow: Extract<DownloadReturnFlow, "edit" | "edit-upgrade">;
    planId: string | null;
    period: PeriodKey;
  } | null>(null);

  const { data: purchases = [] } = useQuery({
    ...trpc.payments.myPurchases.queryOptions(),
    enabled: open,
  });
  const { data: sub } = useQuery({
    ...trpc.subscriptions.mySubscription.queryOptions(),
    enabled: open,
  });
  const { data: plans = [] } = useQuery({
    ...trpc.subscriptions.plans.queryOptions(),
    enabled: open,
  });

  // Опрос статуса платежа после возврата с Робокассы — как на /success/payment.
  const { data: payStatus } = useQuery({
    ...trpc.payments.getByInvId.queryOptions({ invId: checkingInvId ?? 0 }),
    enabled: open && step === "checking" && checkingInvId != null,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? MODAL_POLL_INTERVAL_MS : false,
  });

  const { hasEdit, quota, remaining, unlimited, covered, total } =
    computeEditAccess({
      hasEdit: purchases.some(
        (p) => p.templateId === templateId && p.kind === "edit"
      ),
      price,
      quota: sub?.editQuota ?? 0,
      remaining: sub?.editRemaining ?? 0,
    });

  // Есть ли платные тарифы, отличные от текущего, — гейт карточки
  // «Повысить тариф» на экране лимита.
  const hasUpgradeOption = plans.some(
    (p) => !p.isDefault && p.id !== sub?.planId
  );

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

  const subCheckoutMutation = useMutation(
    trpc.payments.createSubscriptionCheckout.mutationOptions({
      onSuccess: (result, vars) => {
        saveDownloadReturn({
          templateId,
          invId: parseInvIdFromPaymentUrl(result.url),
          format: "pdf",
          flow: "edit-upgrade",
          planId: vars.planId,
        });
        window.location.href = result.url;
      },
      onError: () => setStep("unavailable"),
    })
  );

  const startPurchase = () => {
    lastFlowRef.current = { flow: "edit", planId: null, period: "monthly" };
    setUpgradeContext(false);
    setStep("redirect");
    checkoutMutation.mutate({ templateId, kind: "edit" });
  };

  const startUpgrade = (planId: string, period: PeriodKey) => {
    lastFlowRef.current = { flow: "edit-upgrade", planId, period };
    setUpgradeContext(true);
    setStep("redirect");
    subCheckoutMutation.mutate({ planId, period });
  };

  // «Попробовать снова» / «Повторить попытку» — повторяем последний чекаут.
  const retryLastFlow = () => {
    const last = lastFlowRef.current;
    if (last?.flow === "edit-upgrade") {
      if (last.planId) {
        startUpgrade(last.planId, last.period);
      } else {
        setStep("plans");
      }
      return;
    }
    startPurchase();
  };

  // Возврат с Робокассы: восстанавливаем ветку (покупка/апгрейд) из контекста,
  // сохранённого перед редиректом; контекст одноразовый. Эффект срабатывает
  // один раз на маунт (initialPayment фиксируется страницей при загрузке).
  useEffect(() => {
    if (!initialPayment) {
      return;
    }
    const stored = readDownloadReturn();
    clearDownloadReturn();
    if (stored?.templateId !== templateId) {
      return;
    }
    const isUpgrade = stored.flow === "edit-upgrade";
    setUpgradeContext(isUpgrade);
    lastFlowRef.current = {
      flow: isUpgrade ? "edit-upgrade" : "edit",
      planId: stored.planId ?? null,
      period: stored.period ?? "monthly",
    };
  }, [initialPayment, templateId]);

  // Повторное открытие модалки (после закрытия) начинается со сводки.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStep("info");
      setCheckingInvId(null);
      setLimitChoice(null);
      setUpgradeContext(false);
    }
    wasOpenRef.current = open;
  }, [open]);

  // Платёж подтверждён вебхуком. Разовая покупка: черновик создан на сервере —
  // экран успеха. Апгрейд тарифа: квота обновилась — создаём копию сами.
  // Колбэки стабильны по смыслу — эффект должен срабатывать только на смену
  // статуса платежа.
  // biome-ignore lint/correctness/useExhaustiveDependencies: см. выше
  useEffect(() => {
    if (step !== "checking" || !payStatus) {
      return;
    }
    if (payStatus.status === "paid") {
      invalidateAccess();
      if (lastFlowRef.current?.flow === "edit-upgrade") {
        startDraftCreation();
        return;
      }
      setStep("success");
      return;
    }
    if (payStatus.status !== "pending") {
      setStep("failed");
    }
  }, [payStatus?.status, step]);

  const busy =
    checkoutMutation.isPending ||
    subCheckoutMutation.isPending ||
    createDraftMutation.isPending;

  const handlePrimaryAction = () => {
    if (covered) {
      startDraftCreation();
      return;
    }
    // Тариф в принципе даёт редактирования — предлагаем выбор «купить/повысить»;
    // без квоты (теоретический тариф с нулём) — сразу разовая покупка.
    if (quota !== 0) {
      setStep("limit");
      return;
    }
    startPurchase();
  };

  const handleLimitContinue = () => {
    if (limitChoice === "buy") {
      startPurchase();
      return;
    }
    if (limitChoice === "upgrade") {
      setUpgradeContext(true);
      setStep("plans");
    }
  };

  const headerTitle = t(headerTitleKey(step, upgradeContext));

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden rounded-[10px] border-[#e5e5e5] p-0",
          dialogWidthClass(step)
        )}
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
            onPrimary={handlePrimaryAction}
            price={price}
            quota={quota}
            remaining={remaining}
            templateTitle={templateTitle}
            total={total}
            unlimited={unlimited}
          />
        )}

        {step === "limit" && (
          <EditLimitStep
            choice={limitChoice}
            hasUpgradeOption={hasUpgradeOption}
            onChoose={setLimitChoice}
            onContinue={handleLimitContinue}
            quota={quota}
          />
        )}

        {step === "plans" && (
          <PlansDialogStep
            busy={busy}
            currentPlanId={sub?.planId ?? null}
            onBack={() => {
              setUpgradeContext(false);
              setStep("limit");
            }}
            onSelectPlan={startUpgrade}
            plans={plans as DbPlan[]}
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
              onClick: retryLastFlow,
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
              onClick: retryLastFlow,
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
