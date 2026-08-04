import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clearDownloadReturn,
  type DownloadReturnFlow,
  type InitialPayment,
  readDownloadReturn,
  saveDownloadReturn,
} from "@/lib/download-return";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

type DownloadFormat = "pdf" | "docx";

// Шаги модалки — по макету «Скачивание договора»: выбор формата, экран
// исчерпанного лимита с выбором «купить/повысить тариф», выбор нового тарифа
// и платёжные статусы (редирект на Робокассу, проверка, ошибка, успех).
type Step =
  | "format"
  | "limit"
  | "plans"
  | "redirect"
  | "checking"
  | "failed"
  | "unavailable"
  | "success";

// Стартовый шаг: обычное открытие — выбор формата; возврат с оплаты — сразу
// «Проверяем оплату» либо «Не удалось провести оплату».
function initialStepFor(payment: InitialPayment | null | undefined): Step {
  if (!payment) {
    return "format";
  }
  if (payment.failed || payment.invId == null) {
    return "failed";
  }
  return "checking";
}

function triggerFileDownload(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}

/** Доступ к скачиванию: чем покрыт (покупка/бесплатно/квота) и остаток. */
interface DownloadAccess {
  hasDownload: boolean;
  isFree: boolean;
  quota: number;
  remaining: number;
  unlimited: boolean;
  /** Можно скачать прямо сейчас, без оплаты. */
  canDirect: boolean;
  /** Тариф в принципе даёт скачивания — при исчерпании ведём на экран лимита. */
  hasQuotaPath: boolean;
  /** Ни покупки, ни бесплатного доступа, ни квоты — сразу разовая покупка. */
  needsUpfrontPayment: boolean;
}

function computeAccess({
  hasDownload,
  downloadPrice,
  quota,
  remaining,
}: {
  hasDownload: boolean;
  downloadPrice: number;
  quota: number;
  remaining: number;
}): DownloadAccess {
  const isFree = downloadPrice === 0;
  const unlimited = quota === -1 || remaining === -1;
  const canDirect = hasDownload || isFree || unlimited || remaining > 0;
  const hasQuotaPath = quota !== 0;
  return {
    hasDownload,
    isFree,
    quota,
    remaining,
    unlimited,
    canDirect,
    hasQuotaPath,
    needsUpfrontPayment: !(canDirect || hasQuotaPath),
  };
}

/** Карточка-«радио» (разовая покупка / повышение тарифа, выбор тарифа). */
function ChoiceCard({
  title,
  hint,
  selected,
  onSelect,
}: {
  title: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "flex w-full gap-3 rounded-[10px] border p-3 text-left transition-colors",
        selected ? "border-[#9e1f5a]" : "border-[#e5e5e5] hover:bg-muted/40"
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-[#d4d4d4]">
        {selected && <span className="size-2 rounded-full bg-[#9e1f5a]" />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground text-sm leading-[18px]">
          {title}
        </span>
        <span className="text-muted-foreground text-xs leading-4">{hint}</span>
      </span>
    </button>
  );
}

/** Шаг выбора формата: название шаблона, PDF/DocX, стоимость и остаток квоты;
 * в режиме разовой покупки — цена и «Перейти к оплате». */
function FormatStep({
  templateTitle,
  format,
  onFormatChange,
  access,
  downloadPrice,
  payMode,
  showBack,
  busy,
  onBack,
  onAction,
}: {
  templateTitle: string;
  format: DownloadFormat;
  onFormatChange: (format: DownloadFormat) => void;
  access: DownloadAccess;
  downloadPrice: number;
  payMode: boolean;
  showBack: boolean;
  busy: boolean;
  onBack: () => void;
  onAction: () => void;
}) {
  const { t } = useTranslation();

  let costValue = t("downloadDialog.costIncluded");
  if (access.hasDownload) {
    costValue = t("downloadDialog.costPurchased");
  } else if (access.isFree) {
    costValue = t("downloadDialog.costFree");
  } else if (payMode) {
    costValue = formatTenge(downloadPrice);
  }

  const showQuotaRow =
    !(access.hasDownload || access.isFree || payMode) && access.hasQuotaPath;
  const quotaValue = access.unlimited
    ? t("downloadDialog.downloadsUnlimited")
    : t("downloadDialog.downloadsLeft", {
        count: access.remaining,
        total: access.quota,
      });
  const quotaExhausted = access.remaining === 0 && !access.unlimited;

  return (
    <>
      <div className="flex flex-col gap-3 px-4 py-2">
        <h2 className="font-semibold text-foreground text-xl leading-6">
          {templateTitle}
        </h2>
        <div className="flex flex-col gap-1">
          <label
            className="font-medium text-foreground text-sm leading-[18px]"
            htmlFor="template-download-format"
          >
            {t("downloadDialog.chooseFormat")}
          </label>
          <Select
            onValueChange={(value) => onFormatChange(value as DownloadFormat)}
            value={format}
          >
            <SelectTrigger
              className="w-full rounded-lg border-[#e5e5e5] px-3 text-sm data-[size=default]:h-9"
              id="template-download-format"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="text-sm" value="pdf">
                PDF
              </SelectItem>
              <SelectItem className="text-sm" value="docx">
                DocX
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm leading-[18px]">
          <InfoRow label={t("downloadDialog.cost")} value={costValue} />
          {showQuotaRow && (
            <InfoRow
              label={t("downloadDialog.downloadsRow")}
              value={quotaValue}
              valueClassName={quotaExhausted ? "text-[#ef4444]" : ""}
              withBottomBorder
            />
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 p-4">
        {showBack && (
          <button
            className={OUTLINE_BUTTON_CLASS}
            disabled={busy}
            onClick={onBack}
            type="button"
          >
            {t("downloadDialog.back")}
          </button>
        )}
        <button
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy}
          onClick={onAction}
          type="button"
        >
          {payMode
            ? t("downloadDialog.goToPayment")
            : t("downloadDialog.download")}
        </button>
      </div>
    </>
  );
}

/** Экран исчерпанного лимита: иллюстрация, объяснение и выбор пути —
 * разовая покупка или повышение тарифа. */
function LimitStep({
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
            {t("downloadDialog.limitTitle")}
          </p>
          <p className="mx-auto max-w-[260px] text-muted-foreground text-sm leading-[18px]">
            {t("downloadDialog.limitDescription", { count: quota })}
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
            title={t("downloadDialog.buyOption")}
          />
          {hasUpgradeOption && (
            <ChoiceCard
              hint={t("downloadDialog.upgradeOptionHint")}
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

interface PlanOption {
  id: string;
  name: string;
  downloadQuota: number;
  editQuota: number;
}

/** Шаг выбора нового тарифа при повышении. */
function PlansStep({
  options,
  choice,
  onChoose,
  onBack,
  onContinue,
  busy,
}: {
  options: PlanOption[];
  choice: string | null;
  onChoose: (planId: string) => void;
  onBack: () => void;
  onContinue: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();

  const planLabel = (plan: PlanOption) => {
    const downloads =
      plan.downloadQuota === -1
        ? t("downloadDialog.planDownloadsUnlimited")
        : t("downloadDialog.planDownloads", { count: plan.downloadQuota });
    const edits =
      plan.editQuota === -1
        ? t("downloadDialog.planEditsUnlimited")
        : t("downloadDialog.planEdits", { count: plan.editQuota });
    return `${downloads} · ${edits}`;
  };

  return (
    <>
      <div className="flex flex-col gap-3 px-4 py-2">
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold text-foreground text-xl leading-6">
            {t("downloadDialog.choosePlan")}
          </h2>
          <p className="text-muted-foreground text-sm leading-[18px]">
            {t("downloadDialog.choosePlanHint")}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {options.map((plan) => (
            <ChoiceCard
              hint={planLabel(plan)}
              key={plan.id}
              onSelect={() => onChoose(plan.id)}
              selected={choice === plan.id}
              title={plan.name}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 p-4">
        <button
          className={OUTLINE_BUTTON_CLASS}
          disabled={busy}
          onClick={onBack}
          type="button"
        >
          {t("downloadDialog.back")}
        </button>
        <button
          className={PRIMARY_BUTTON_CLASS}
          disabled={choice === null || busy}
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
 * Модалка «Скачать договор» (по макету): выбор формата PDF/DocX, стоимость и
 * остаток квоты скачиваний; при исчерпанном лимите — разовая покупка или
 * повышение тарифа с оплатой через Робокассу, не покидая флоу (статусы
 * «Переходим к оплате», «Проверяем оплату», ошибка/успех — внутри модалки).
 */
export function TemplateDownloadDialog({
  templateId,
  templateTitle,
  downloadPrice,
  open,
  onOpenChange,
  initialPayment,
}: {
  templateId: string;
  templateTitle: string;
  downloadPrice: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPayment?: InitialPayment | null;
}) {
  const { t, i18n } = useTranslation();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>(() => initialStepFor(initialPayment));
  const [format, setFormat] = useState<DownloadFormat>("pdf");
  // «Скачать договор» выбран на экране лимита — шаг формата показывается в
  // варианте разовой покупки (цена + «Перейти к оплате» + «Назад»).
  const [buyChosen, setBuyChosen] = useState(false);
  const [limitChoice, setLimitChoice] = useState<"buy" | "upgrade" | null>(
    null
  );
  const [planChoice, setPlanChoice] = useState<string | null>(null);
  // Платёжные статусы озаглавлены «Повышение тарифа», когда пришли из ветки
  // апгрейда, и «Скачать договор» — из разовой покупки.
  const [upgradeContext, setUpgradeContext] = useState(false);
  const [checkingInvId, setCheckingInvId] = useState<number | null>(() =>
    initialPayment && !initialPayment.failed ? initialPayment.invId : null
  );

  const autoDownloadedRef = useRef(false);
  // Последний успешно собранный файл: кнопка «Скачать договор» на экране
  // успеха отдаёт его повторно, не тратя квоту на новый запрос.
  const lastFileRef = useRef<{ dataUrl: string; fileName: string } | null>(
    null
  );
  const lastFlowRef = useRef<{
    flow: DownloadReturnFlow;
    planId: string | null;
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

  const quota = sub?.downloadQuota ?? 0;
  const access = computeAccess({
    hasDownload: purchases.some((p) => p.templateId === templateId),
    downloadPrice,
    quota,
    remaining: sub?.downloadRemaining ?? 0,
  });
  const payModeView = buyChosen || access.needsUpfrontPayment;

  // Тарифы, на которые есть смысл повышаться: активные платные с большей
  // квотой скачиваний, чем текущая.
  const planOptions = plans.filter(
    (p) =>
      !p.isDefault &&
      p.id !== sub?.planId &&
      (p.downloadQuota === -1 || p.downloadQuota > quota)
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

  const downloadMutation = useMutation(
    trpc.templates.downloadPurchased.mutationOptions({
      onSuccess: (result) => {
        triggerFileDownload(result.dataUrl, result.fileName);
        lastFileRef.current = result;
        // Скачивание могло списать квоту, а «выданный» документ появился в
        // «Моих документах» — обновляем оба виджета.
        invalidateAccess();
        clearDownloadReturn();
        setStep("success");
      },
      onError: (err) => {
        if (err.data?.code === "FORBIDDEN") {
          setStep("limit");
          return;
        }
        toast.error(err.message);
      },
    })
  );

  const checkoutMutation = useMutation(
    trpc.payments.createTemplateCheckout.mutationOptions({
      onSuccess: (result) => {
        if (result.alreadyPurchased) {
          invalidateAccess();
          downloadMutation.mutate({
            templateId,
            locale: i18n.language,
            format,
          });
          return;
        }
        saveDownloadReturn({
          templateId,
          invId: parseInvIdFromPaymentUrl(result.url),
          format,
          flow: "purchase",
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
          format,
          flow: "upgrade",
          planId: vars.planId,
        });
        window.location.href = result.url;
      },
      onError: () => setStep("unavailable"),
    })
  );

  const downloadNow = () => {
    downloadMutation.mutate({ templateId, locale: i18n.language, format });
  };

  const startPurchase = () => {
    lastFlowRef.current = { flow: "purchase", planId: null };
    setUpgradeContext(false);
    setStep("redirect");
    checkoutMutation.mutate({ templateId, kind: "download" });
  };

  const startUpgrade = (planId: string) => {
    lastFlowRef.current = { flow: "upgrade", planId };
    setUpgradeContext(true);
    setStep("redirect");
    subCheckoutMutation.mutate({ planId, period: "monthly" });
  };

  // «Попробовать снова» / «Повторить попытку» — повторяем последний чекаут.
  const retryLastFlow = () => {
    const last = lastFlowRef.current;
    if (last?.flow === "upgrade") {
      if (last.planId) {
        startUpgrade(last.planId);
      } else {
        setStep("plans");
      }
      return;
    }
    startPurchase();
  };

  // Возврат с Робокассы: восстанавливаем контекст, сохранённый перед
  // редиректом на оплату (формат, ветка «покупка/апгрейд», тариф). Шаг и invId
  // уже выставлены инициализаторами состояния — эффект только дочитывает
  // sessionStorage и срабатывает один раз на маунт.
  useEffect(() => {
    if (!initialPayment) {
      return;
    }
    const stored = readDownloadReturn();
    clearDownloadReturn();
    if (stored?.templateId !== templateId) {
      return;
    }
    setFormat(stored.format);
    setUpgradeContext(stored.flow === "upgrade");
    lastFlowRef.current = {
      flow: stored.flow,
      planId: stored.planId ?? null,
    };
    setPlanChoice(stored.planId ?? null);
  }, [initialPayment, templateId]);

  // Повторное открытие модалки (после закрытия) начинается с чистого шага
  // выбора формата. Первый маунт сюда не попадает — сброс только на переходе
  // «закрыта → открыта».
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStep("format");
      setBuyChosen(false);
      setLimitChoice(null);
      setPlanChoice(null);
      setUpgradeContext(false);
      setCheckingInvId(null);
      autoDownloadedRef.current = false;
      lastFileRef.current = null;
    }
    wasOpenRef.current = open;
  }, [open]);

  // Платёж подтверждён вебхуком — доступ выдан: обновляем кэш и сразу отдаём
  // файл (экран успеха: «Договор скачивается автоматически»). Эффект должен
  // срабатывать только на смену статуса платежа, не на пересоздание колбэков.
  // biome-ignore lint/correctness/useExhaustiveDependencies: см. выше
  useEffect(() => {
    if (step !== "checking" || !payStatus) {
      return;
    }
    if (payStatus.status === "paid") {
      if (!autoDownloadedRef.current) {
        autoDownloadedRef.current = true;
        invalidateAccess();
        downloadNow();
      }
      return;
    }
    if (payStatus.status !== "pending") {
      setStep("failed");
    }
  }, [payStatus?.status, step]);

  const busy =
    downloadMutation.isPending ||
    checkoutMutation.isPending ||
    subCheckoutMutation.isPending;

  // Действие главной кнопки шага формата.
  const handleFormatAction = () => {
    if (payModeView) {
      startPurchase();
      return;
    }
    if (access.canDirect) {
      downloadNow();
      return;
    }
    setStep("limit");
  };

  const handleLimitContinue = () => {
    if (limitChoice === "buy") {
      setBuyChosen(true);
      setStep("format");
      return;
    }
    if (limitChoice === "upgrade") {
      setUpgradeContext(true);
      setStep("plans");
    }
  };

  // Повторное скачивание с экрана успеха — без нового списания квоты.
  const handleManualDownload = () => {
    const file = lastFileRef.current;
    if (file) {
      triggerFileDownload(file.dataUrl, file.fileName);
      return;
    }
    downloadNow();
  };

  const wide = step === "limit" || step === "plans";
  const showUpgradeTitle = upgradeContext && step !== "limit";
  const headerTitle = showUpgradeTitle
    ? t("downloadDialog.upgradeTitle")
    : t("downloadDialog.title");

  const successHint = `${
    upgradeContext && sub?.planName
      ? `${t("downloadDialog.planActivated", { plan: sub.planName })} `
      : ""
  }${t("downloadDialog.successHint")}`;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden rounded-[10px] border-[#e5e5e5] p-0",
          wide ? "sm:max-w-[450px]" : "sm:max-w-[320px]"
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

        {step === "format" && (
          <FormatStep
            access={access}
            busy={busy}
            downloadPrice={downloadPrice}
            format={format}
            onAction={handleFormatAction}
            onBack={() => {
              setBuyChosen(false);
              setStep("limit");
            }}
            onFormatChange={setFormat}
            payMode={payModeView}
            showBack={buyChosen}
            templateTitle={templateTitle}
          />
        )}

        {step === "limit" && (
          <LimitStep
            choice={limitChoice}
            hasUpgradeOption={planOptions.length > 0}
            onChoose={setLimitChoice}
            onContinue={handleLimitContinue}
            quota={quota}
          />
        )}

        {step === "plans" && (
          <PlansStep
            busy={busy}
            choice={planChoice}
            onBack={() => {
              setUpgradeContext(false);
              setStep("limit");
            }}
            onChoose={setPlanChoice}
            onContinue={() => {
              if (planChoice) {
                startUpgrade(planChoice);
              }
            }}
            options={planOptions}
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
              label: t("downloadDialog.download"),
              icon: "download",
              disabled: downloadMutation.isPending,
              onClick: handleManualDownload,
            }}
            hint={successHint}
            title={t("downloadDialog.successTitle")}
            tone="success"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
