import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

import {
  ErrorNote,
  formatCountdown,
  NETWORK_ERROR,
  OUTLINE_BTN,
  PasswordInput,
  PRIMARY_BTN,
  useCountdown,
} from "./password-dialog-shared";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const CODE_LENGTH = 6;
const CODE_REGEX = /^\d{6}$/;
const NON_DIGIT_REGEX = /\D/g;
const PASSWORD_REQUIRED_ERROR = "Введите текущий пароль";
const NO_STEP_UP_ERROR = "Установите пароль, чтобы изменить контактные данные.";
const INVALID_CODE_ERROR = "Неверный код.";
const EXPIRED_CODE_ERROR = "Код устарел. Запросите новый.";
const TOO_MANY_ATTEMPTS_ERROR = "Слишком много попыток. Запросите новый код.";
const COOLDOWN_NO_CODE_ERROR =
  "Слишком часто. Подождите таймер и запросите код заново.";
const STATUS_FAILED_ERROR = "Не удалось загрузить данные. Обновите страницу.";

type Channel = "email" | "phone";
type Step = "value" | "code";

const COPY = {
  email: {
    title: "Электронная почта",
    fieldLabel: "Электронная почта",
    placeholder: "you@example.com",
    inputType: "email",
    invalidValue: "Введите корректную почту",
    taken: "Эта почта уже используется",
    removed: "Почта удалена",
    saved: "Почта обновлена",
    remove: "Удалить почту",
  },
  phone: {
    title: "Номер телефона",
    fieldLabel: "Номер телефона",
    placeholder: "+7 700 000 00 00",
    inputType: "tel",
    invalidValue: "Введите корректный номер",
    taken: "Этот номер уже используется",
    removed: "Номер удалён",
    saved: "Номер обновлён",
    remove: "Удалить номер",
  },
} as const;

// Куда реально ушёл код, решает сервер: новый контакт (при подтверждении
// паролем) или текущий телефон (для аккаунтов без пароля).
function describeDestination(sentTo: string) {
  return sentTo.includes("@") ? `почту ${sentTo}` : `номер ${sentTo}`;
}

function ValueStep({
  copy,
  value,
  onValueChange,
  valueError,
  withPassword,
  currentPassword,
  onPasswordChange,
  passwordError,
  showPassword,
  onToggleShowPassword,
  isRemoval,
  removing,
  sending,
  canSend,
  busy,
  statusError,
  onCancel,
  onRemove,
  onSend,
}: {
  copy: (typeof COPY)[Channel];
  value: string;
  onValueChange: (value: string) => void;
  valueError: string | null;
  withPassword: boolean;
  currentPassword: string;
  onPasswordChange: (value: string) => void;
  passwordError: string | null;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  isRemoval: boolean;
  removing: boolean;
  sending: boolean;
  canSend: boolean;
  busy: boolean;
  statusError: string | null;
  onCancel: () => void;
  onRemove: () => void;
  onSend: () => void;
}) {
  const valueFieldId = useId();
  const passwordFieldId = useId();
  return (
    <>
      <div className="flex flex-col gap-4 py-1">
        <div className="flex flex-col gap-2">
          <Label htmlFor={valueFieldId}>{copy.fieldLabel}</Label>
          <Input
            className={cn(valueError && "border-destructive")}
            id={valueFieldId}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={copy.placeholder}
            type={copy.inputType}
            value={value}
          />
          {valueError && <ErrorNote message={valueError} />}
        </div>
        {withPassword && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={passwordFieldId}>Текущий пароль</Label>
            <PasswordInput
              autoComplete="current-password"
              id={passwordFieldId}
              invalid={Boolean(passwordError)}
              onChange={onPasswordChange}
              onToggleShow={onToggleShowPassword}
              show={showPassword}
              value={currentPassword}
            />
            {passwordError && <ErrorNote message={passwordError} />}
          </div>
        )}
        {statusError && <ErrorNote message={statusError} />}
      </div>
      <DialogFooter>
        <Button
          className={OUTLINE_BTN}
          disabled={busy}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Отменить
        </Button>
        {isRemoval ? (
          <Button
            className="h-9 bg-destructive px-4 text-sm text-white hover:bg-destructive/90"
            disabled={busy}
            onClick={onRemove}
            type="button"
          >
            {removing ? "Удаляем..." : copy.remove}
          </Button>
        ) : (
          <Button
            className={PRIMARY_BTN}
            disabled={!canSend || busy}
            onClick={onSend}
            type="button"
          >
            {sending ? (
              <>
                Отправляем
                <Loader2Icon className="size-4 animate-spin" />
              </>
            ) : (
              "Отправить код"
            )}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function CodeStep({
  destination,
  code,
  onCodeChange,
  codeError,
  resendRemainingSeconds,
  resendDisabled,
  onResend,
  onBack,
  onConfirm,
  saving,
  busy,
}: {
  destination: string;
  code: string;
  onCodeChange: (code: string) => void;
  codeError: string | null;
  resendRemainingSeconds: number;
  resendDisabled: boolean;
  onResend: () => void;
  onBack: () => void;
  onConfirm: () => void;
  saving: boolean;
  busy: boolean;
}) {
  const codeFieldId = useId();
  return (
    <>
      <div className="flex flex-col gap-2 py-1">
        <Label htmlFor={codeFieldId}>Код отправлен на {destination}</Label>
        <Input
          autoComplete="one-time-code"
          className={cn(codeError && "border-destructive")}
          id={codeFieldId}
          inputMode="numeric"
          // Санитайзим и обрезаем сами, чтобы вставка «12 34 56» не терялась
          // из-за maxLength до удаления пробелов.
          onChange={(e) =>
            onCodeChange(
              e.target.value.replace(NON_DIGIT_REGEX, "").slice(0, CODE_LENGTH)
            )
          }
          placeholder="Введите код"
          value={code}
        />
        {codeError && <ErrorNote message={codeError} />}
        <button
          className="self-start text-muted-foreground text-sm hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground"
          disabled={resendDisabled}
          onClick={onResend}
          type="button"
        >
          {resendRemainingSeconds > 0
            ? `Отправить код ещё раз (${formatCountdown(resendRemainingSeconds)})`
            : "Отправить код ещё раз"}
        </button>
      </div>
      <DialogFooter>
        <Button
          className={OUTLINE_BTN}
          disabled={busy}
          onClick={onBack}
          type="button"
          variant="outline"
        >
          Назад
        </Button>
        <Button
          className={PRIMARY_BTN}
          // busy включает и отправку кода: подтверждение и повторная отправка
          // не должны идти одновременно (иначе verify бьётся о новый код).
          disabled={!CODE_REGEX.test(code) || busy}
          onClick={onConfirm}
          type="button"
        >
          {saving ? (
            <>
              Сохраняем
              <Loader2Icon className="size-4 animate-spin" />
            </>
          ) : (
            "Подтвердить"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

export function VerifyContactDialog({
  open,
  onClose,
  channel,
  currentValue,
}: {
  open: boolean;
  onClose: () => void;
  channel: Channel;
  currentValue: string | null;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const copy = COPY[channel];

  const [step, setStep] = useState<Step>("value");
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [valueError, setValueError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // Куда сервер отправил код (новый контакт либо текущий телефон).
  const [sentTo, setSentTo] = useState("");
  const resend = useCountdown();
  // Блокировка после неверных паролей переживает закрытие диалога —
  // на сервере она всё равно действует.
  const lock = useCountdown();

  // Есть ли у аккаунта пароль — от этого зависит шаг-ап: пароль + код на
  // новый контакт либо (без пароля) код на текущий телефон.
  const signupStatusQuery = useQuery(trpc.auth.signupStatus.queryOptions());
  const signupStatus = signupStatusQuery.data;
  const statusLoaded = Boolean(signupStatus);
  const statusFailed = signupStatusQuery.isError;
  const hasPassword = signupStatus?.hasPassword ?? false;

  const requestMutation = useMutation(
    trpc.account.requestContactChangeCode.mutationOptions()
  );
  const verifyMutation = useMutation(
    trpc.account.verifyContactCode.mutationOptions()
  );
  const clearMutation = useMutation(
    trpc.account.updateProfile.mutationOptions()
  );

  // Полный сброс только на открытии (эффект зависит лишь от open). Значение
  // для префилла читаем через ref, чтобы рефетч account.me на фокусе окна
  // (пользователь ушёл за кодом) не переигрывал сброс и не стирал ввод.
  const currentValueRef = useRef(currentValue);
  currentValueRef.current = currentValue;
  useEffect(() => {
    if (open) {
      setStep("value");
      setValue(currentValueRef.current ?? "");
      setCode("");
      setValueError(null);
      setCodeError(null);
      setCurrentPassword("");
      setShowPassword(false);
      setPasswordError(null);
      setSentTo("");
    }
  }, [open]);

  const invalidateMe = () =>
    queryClient.invalidateQueries(trpc.account.me.queryFilter());

  const trimmed = value.trim();
  const isRemoval = Boolean(currentValue) && trimmed.length === 0;
  const unchanged = trimmed === (currentValue ?? "");

  const applyStepUpFailure = (
    result:
      | { status: "password_required" }
      | { status: "invalid_password"; attemptsLeft: number }
      | { status: "locked"; retryAfterSeconds: number }
      | { status: "no_step_up" }
  ) => {
    setStep("value");
    if (result.status === "locked") {
      lock.start(result.retryAfterSeconds);
      setPasswordError(null);
      return;
    }
    if (result.status === "invalid_password") {
      setPasswordError(
        result.attemptsLeft === 1
          ? "Неверный пароль.\nОсталась одна попытка."
          : "Неверный пароль"
      );
      return;
    }
    if (result.status === "password_required") {
      // signupStatus устарел (пароль появился в другой вкладке) — обновляем,
      // чтобы показать поле пароля.
      queryClient.invalidateQueries(trpc.auth.signupStatus.queryFilter());
      setPasswordError(PASSWORD_REQUIRED_ERROR);
      return;
    }
    setValueError(NO_STEP_UP_ERROR);
  };

  const sendCode = async () => {
    try {
      const result = await requestMutation.mutateAsync({
        channel,
        value: trimmed,
        currentPassword: hasPassword ? currentPassword : undefined,
      });
      switch (result.status) {
        case "invalid_value":
          setStep("value");
          setValueError(copy.invalidValue);
          return;
        case "taken":
          setStep("value");
          setValueError(copy.taken);
          return;
        case "password_required":
        case "invalid_password":
        case "locked":
        case "no_step_up":
          applyStepUpFailure(result);
          return;
        default: {
          resend.start(result.retryAfterSeconds);
          if (!result.sentTo) {
            // "cooldown" без живого кода (прежний использован/сгорел): не ведём
            // на шаг ввода, где любой код был бы неверным — просим подождать.
            const wait = COOLDOWN_NO_CODE_ERROR;
            if (step === "code") {
              setCodeError(wait);
            } else {
              setValueError(wait);
            }
            return;
          }
          setSentTo(result.sentTo);
          if (result.status === "sent") {
            // Пришёл новый код — очищаем поле от прежнего ввода. На
            // "cooldown" прежний код ещё жив, ничего не трогаем.
            setCode("");
            setCodeError(null);
          }
          setStep("code");
        }
      }
    } catch {
      toast.error(NETWORK_ERROR);
    }
  };

  const removeContact = async () => {
    try {
      await clearMutation.mutateAsync(
        channel === "email" ? { email: null } : { phoneNumber: null }
      );
      invalidateMe();
      toast.success(copy.removed);
      onClose();
    } catch {
      toast.error(NETWORK_ERROR);
    }
  };

  const verify = async () => {
    if (!CODE_REGEX.test(code)) {
      return;
    }
    try {
      const result = await verifyMutation.mutateAsync({ channel, code });
      switch (result.status) {
        case "ok":
          invalidateMe();
          toast.success(copy.saved);
          onClose();
          return;
        case "invalid_code":
          setCode("");
          setCodeError(INVALID_CODE_ERROR);
          return;
        case "code_expired":
          setCode("");
          setCodeError(EXPIRED_CODE_ERROR);
          return;
        case "too_many_attempts":
          setCode("");
          setCodeError(TOO_MANY_ATTEMPTS_ERROR);
          return;
        default:
          setStep("value");
          setValueError(copy.taken);
      }
    } catch {
      toast.error(NETWORK_ERROR);
    }
  };

  const busy =
    requestMutation.isPending ||
    verifyMutation.isPending ||
    clearMutation.isPending;
  const guardClose = (event: Event) => {
    if (busy) {
      event.preventDefault();
    }
  };

  const passwordStepError = lock.active
    ? `Слишком много попыток.\nПовторите через ${formatCountdown(lock.remainingSeconds)}.`
    : passwordError;
  const canSend =
    !unchanged &&
    statusLoaded &&
    !lock.active &&
    (!hasPassword || currentPassword.length > 0);

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!(next || busy)) {
          onClose();
        }
      }}
      open={open}
    >
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={guardClose}
        onInteractOutside={guardClose}
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
        </DialogHeader>

        {step === "value" && (
          <ValueStep
            busy={busy}
            canSend={canSend}
            copy={copy}
            currentPassword={currentPassword}
            isRemoval={isRemoval}
            onCancel={onClose}
            onPasswordChange={(next) => {
              setCurrentPassword(next);
              setPasswordError(null);
            }}
            onRemove={removeContact}
            onSend={sendCode}
            onToggleShowPassword={() => setShowPassword((s) => !s)}
            onValueChange={(next) => {
              setValue(next);
              setValueError(null);
            }}
            passwordError={passwordStepError}
            removing={clearMutation.isPending}
            sending={requestMutation.isPending}
            showPassword={showPassword}
            statusError={statusFailed ? STATUS_FAILED_ERROR : null}
            value={value}
            valueError={valueError}
            withPassword={hasPassword}
          />
        )}

        {step === "code" && (
          <CodeStep
            busy={busy}
            code={code}
            codeError={codeError}
            destination={describeDestination(sentTo)}
            onBack={() => setStep("value")}
            onCodeChange={(next) => {
              setCode(next);
              setCodeError(null);
            }}
            onConfirm={verify}
            onResend={sendCode}
            resendDisabled={resend.remainingSeconds > 0 || busy}
            resendRemainingSeconds={resend.remainingSeconds}
            saving={verifyMutation.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
