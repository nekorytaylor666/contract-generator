import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, InfoIcon, Loader2Icon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
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
const RESEND_COOLDOWN_SECONDS = 60;
const NO_PASSWORD_ERROR = "Для аккаунта не установлен пароль";
const NO_EMAIL_ERROR = "Сначала укажите почту в разделе «Личные данные».";
const INVALID_CODE_ERROR = "Неверный код";
const EXPIRED_CODE_ERROR = "Код устарел. Запросите новый.";
const TOO_MANY_ATTEMPTS_ERROR = "Слишком много попыток. Запросите новый код.";

type Mode = "enable" | "disable";
type Step = "intro" | "password" | "code" | "success";

function passwordFailureMessage(
  result:
    | { status: "no_password" }
    | { status: "no_email" }
    | { status: "invalid"; attemptsLeft: number }
): string {
  if (result.status === "invalid") {
    return result.attemptsLeft === 1
      ? "Неверный пароль.\nОсталась одна попытка."
      : "Неверный пароль";
  }
  return result.status === "no_email" ? NO_EMAIL_ERROR : NO_PASSWORD_ERROR;
}

// better-auth отдаёт ошибки проверки кода текстом — переводим известные.
function mapVerifyOtpError(message: string): string {
  if (message.includes("Invalid code")) {
    return INVALID_CODE_ERROR;
  }
  if (message.includes("expired")) {
    return EXPIRED_CODE_ERROR;
  }
  if (message.includes("Too many attempts")) {
    return TOO_MANY_ATTEMPTS_ERROR;
  }
  return message || NETWORK_ERROR;
}

function CodeStep({
  email,
  code,
  codeError,
  onCodeChange,
  resendRemainingSeconds,
  onResend,
  onBack,
  onConfirm,
  verifying,
  busy,
}: {
  email: string | null;
  code: string;
  codeError: string | null;
  onCodeChange: (code: string) => void;
  resendRemainingSeconds: number;
  onResend: () => void;
  onBack: () => void;
  onConfirm: () => void;
  verifying: boolean;
  busy: boolean;
}) {
  const codeFieldId = useId();
  return (
    <>
      <div className="flex flex-col gap-4 py-1">
        <p className="text-foreground text-sm">
          Мы отправили код на <span className="underline">{email}</span>
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor={codeFieldId}>Введите код</Label>
          <div className="relative">
            <Input
              autoComplete="one-time-code"
              className={cn(
                "h-10 rounded-lg border-border bg-background px-4 pr-24 text-sm",
                codeError && "border-destructive"
              )}
              id={codeFieldId}
              inputMode="numeric"
              onChange={(e) =>
                onCodeChange(
                  e.target.value
                    .replace(NON_DIGIT_REGEX, "")
                    .slice(0, CODE_LENGTH)
                )
              }
              placeholder="Введите код"
              value={code}
            />
            <div className="absolute top-1/2 right-3 -translate-y-1/2 text-sm">
              {resendRemainingSeconds > 0 ? (
                <span className="text-muted-foreground">
                  {resendRemainingSeconds} с.
                </span>
              ) : (
                <button
                  className="text-foreground hover:underline disabled:opacity-60"
                  disabled={busy}
                  onClick={onResend}
                  type="button"
                >
                  Повторить
                </button>
              )}
            </div>
          </div>
          {codeError && <ErrorNote message={codeError} />}
        </div>
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
          disabled={!CODE_REGEX.test(code) || busy}
          onClick={onConfirm}
          type="button"
        >
          {verifying ? (
            <>
              Подтверждаем
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

/**
 * Диалог включения/отключения двухфакторной аутентификации (коды на почту).
 * Включение: интро → пароль → код из письма → готово. Отключение: пароль.
 */
export function TwoFactorDialog({
  open,
  onClose,
  mode,
  email,
}: {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  email: string | null;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const passwordFieldId = useId();

  const [step, setStep] = useState<Step>("intro");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  // Отправка/проверка кода идут напрямую в better-auth (не через tRPC).
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const resend = useCountdown();
  // Блокировка после неверных паролей переживает закрытие диалога —
  // на сервере она всё равно действует.
  const lock = useCountdown();

  const enableMutation = useMutation(
    trpc.auth.twoFactorEnable.mutationOptions()
  );
  const disableMutation = useMutation(
    trpc.auth.twoFactorDisable.mutationOptions()
  );

  useEffect(() => {
    if (open) {
      setStep(mode === "enable" ? "intro" : "password");
      setPassword("");
      setShowPassword(false);
      setPasswordError(null);
      setCode("");
      setCodeError(null);
    }
  }, [open, mode]);

  const invalidateMe = () =>
    queryClient.invalidateQueries(trpc.account.me.queryFilter());

  const applyPasswordFailure = (
    result:
      | { status: "no_password" }
      | { status: "no_email" }
      | { status: "invalid"; attemptsLeft: number }
      | { status: "locked"; retryAfterSeconds: number }
  ) => {
    if (result.status === "locked") {
      lock.start(result.retryAfterSeconds);
      setPasswordError(null);
      return;
    }
    setPasswordError(passwordFailureMessage(result));
  };

  const sendCode = async () => {
    setSendingCode(true);
    try {
      const { error } = await authClient.twoFactor.sendOtp();
      if (error) {
        toast.error(error.message ?? NETWORK_ERROR);
        return;
      }
      resend.start(RESEND_COOLDOWN_SECONDS);
      setCode("");
      setCodeError(null);
      setStep("code");
    } finally {
      setSendingCode(false);
    }
  };

  const continueEnable = async () => {
    try {
      const result = await enableMutation.mutateAsync({ password });
      if (result.status !== "ok") {
        applyPasswordFailure(result);
        return;
      }
      setPasswordError(null);
      await sendCode();
    } catch {
      toast.error(NETWORK_ERROR);
    }
  };

  const continueDisable = async () => {
    try {
      const result = await disableMutation.mutateAsync({ password });
      if (result.status !== "ok") {
        applyPasswordFailure(result);
        return;
      }
      invalidateMe();
      toast.success("Двухфакторная аутентификация отключена");
      onClose();
    } catch {
      toast.error(NETWORK_ERROR);
    }
  };

  const verifyCode = async () => {
    if (!CODE_REGEX.test(code)) {
      return;
    }
    setVerifyingCode(true);
    try {
      const { error } = await authClient.twoFactor.verifyOtp({ code });
      if (error) {
        setCode("");
        setCodeError(mapVerifyOtpError(error.message ?? ""));
        return;
      }
      invalidateMe();
      setStep("success");
    } finally {
      setVerifyingCode(false);
    }
  };

  const busy =
    enableMutation.isPending ||
    disableMutation.isPending ||
    sendingCode ||
    verifyingCode;
  const guardClose = (event: Event) => {
    if (busy) {
      event.preventDefault();
    }
  };

  const passwordStepError = lock.active
    ? `Слишком много попыток.\nПовторите через ${formatCountdown(lock.remainingSeconds)}.`
    : passwordError;

  const passwordPending = enableMutation.isPending || disableMutation.isPending;

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
          <DialogTitle>Двухфакторная аутентификация</DialogTitle>
        </DialogHeader>

        {step === "intro" && (
          <>
            <div className="flex items-start gap-2.5 rounded-lg border border-border p-4">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground text-sm">
                  Дополнительная защита аккаунта
                </p>
                <p className="text-muted-foreground text-sm">
                  При входе будем присылать 6-значный код на почту{" "}
                  <span className="underline">{email}</span>
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                className={OUTLINE_BTN}
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Отменить
              </Button>
              <Button
                className={PRIMARY_BTN}
                onClick={() => setStep("password")}
                type="button"
              >
                Продолжить
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "password" && (
          <>
            <div className="flex flex-col gap-2 py-1">
              <Label htmlFor={passwordFieldId}>Введите пароль</Label>
              <PasswordInput
                autoComplete="current-password"
                id={passwordFieldId}
                invalid={Boolean(passwordStepError)}
                onChange={(value) => {
                  setPassword(value);
                  setPasswordError(null);
                }}
                onToggleShow={() => setShowPassword((s) => !s)}
                show={showPassword}
                value={password}
              />
              {passwordStepError ? (
                <ErrorNote message={passwordStepError} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  {mode === "enable"
                    ? "Для подключения двухфакторной аутентификации, подтвердите, что это вы."
                    : "Чтобы отключить двухфакторную аутентификацию, подтвердите, что это вы."}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                className={OUTLINE_BTN}
                disabled={busy}
                onClick={mode === "enable" ? () => setStep("intro") : onClose}
                type="button"
                variant="outline"
              >
                {mode === "enable" ? "Назад" : "Отменить"}
              </Button>
              <Button
                className={PRIMARY_BTN}
                disabled={password.length === 0 || busy || lock.active}
                onClick={mode === "enable" ? continueEnable : continueDisable}
                type="button"
              >
                {passwordPending || sendingCode ? (
                  <>
                    Проверяем
                    <Loader2Icon className="size-4 animate-spin" />
                  </>
                ) : (
                  "Продолжить"
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "code" && (
          <CodeStep
            busy={busy}
            code={code}
            codeError={codeError}
            email={email}
            onBack={() => setStep("password")}
            onCodeChange={(next) => {
              setCode(next);
              setCodeError(null);
            }}
            onConfirm={verifyCode}
            onResend={sendCode}
            resendRemainingSeconds={resend.remainingSeconds}
            verifying={verifyingCode}
          />
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-green-100">
              <CheckIcon className="size-6 text-green-700" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium text-base text-foreground">Готово!</p>
              <p className="text-muted-foreground text-sm">
                При каждом входе будем отправлять
                <br />
                код на <span className="underline">{email}</span>
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
