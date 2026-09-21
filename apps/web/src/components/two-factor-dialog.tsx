import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, InfoIcon, Loader2Icon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

import {
  ErrorNote,
  formatCountdown,
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

type Mode = "enable" | "disable";
type Step = "intro" | "password" | "code" | "success";
type Translate = (key: string, options?: Record<string, unknown>) => string;

function passwordFailureMessage(
  result:
    | { status: "no_password" }
    | { status: "no_email" }
    | { status: "invalid"; attemptsLeft: number },
  t: Translate
): string {
  if (result.status === "invalid") {
    return result.attemptsLeft === 1
      ? t("security.twoFactor.wrongPasswordLastAttempt")
      : t("security.twoFactor.wrongPassword");
  }
  return result.status === "no_email"
    ? t("security.twoFactor.noEmail")
    : t("security.twoFactor.noPassword");
}

// better-auth отдаёт ошибки проверки кода текстом — переводим известные.
function mapVerifyOtpError(message: string, t: Translate): string {
  if (message.includes("Invalid code")) {
    return t("security.twoFactor.invalidCode");
  }
  if (message.includes("expired")) {
    return t("security.twoFactor.expiredCode");
  }
  if (message.includes("Too many attempts")) {
    return t("security.twoFactor.tooManyAttempts");
  }
  return message || t("security.twoFactor.networkError");
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
  const { t } = useTranslation();
  const codeFieldId = useId();
  return (
    <>
      <div className="flex flex-col gap-4 py-1">
        <p className="text-foreground text-sm">
          <Trans
            components={{ u: <span className="underline" /> }}
            i18nKey="security.twoFactor.codeSentTo"
            values={{ email: email ?? "" }}
          />
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor={codeFieldId}>
            {t("security.twoFactor.codeLabel")}
          </Label>
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
              placeholder={t("security.twoFactor.codePlaceholder")}
              value={code}
            />
            <div className="absolute top-1/2 right-3 -translate-y-1/2 text-sm">
              {resendRemainingSeconds > 0 ? (
                <span className="text-muted-foreground">
                  {t("security.twoFactor.resendIn", {
                    seconds: resendRemainingSeconds,
                  })}
                </span>
              ) : (
                <button
                  className="text-foreground hover:underline disabled:opacity-60"
                  disabled={busy}
                  onClick={onResend}
                  type="button"
                >
                  {t("security.twoFactor.resend")}
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
          {t("security.twoFactor.back")}
        </Button>
        <Button
          className={PRIMARY_BTN}
          disabled={!CODE_REGEX.test(code) || busy}
          onClick={onConfirm}
          type="button"
        >
          {verifying ? (
            <>
              {t("security.twoFactor.confirming")}
              <Loader2Icon className="size-4 animate-spin" />
            </>
          ) : (
            t("security.twoFactor.confirm")
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
  const { t } = useTranslation();
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

  const networkError = t("security.twoFactor.networkError");

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
    setPasswordError(passwordFailureMessage(result, t));
  };

  const sendCode = async () => {
    setSendingCode(true);
    try {
      const { error } = await authClient.twoFactor.sendOtp();
      if (error) {
        toast.error(error.message ?? networkError);
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
      toast.error(networkError);
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
      toast.success(t("security.twoFactor.disabledToast"));
      onClose();
    } catch {
      toast.error(networkError);
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
        setCodeError(mapVerifyOtpError(error.message ?? "", t));
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
    ? t("security.twoFactor.lockedRetry", {
        time: formatCountdown(lock.remainingSeconds),
      })
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
          <DialogTitle>{t("security.twoFactor.title")}</DialogTitle>
        </DialogHeader>

        {step === "intro" && (
          <>
            <div className="flex items-start gap-2.5 rounded-lg border border-border p-4">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground text-sm">
                  {t("security.twoFactor.introTitle")}
                </p>
                <p className="text-muted-foreground text-sm">
                  <Trans
                    components={{ u: <span className="underline" /> }}
                    i18nKey="security.twoFactor.introText"
                    values={{ email: email ?? "" }}
                  />
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
                {t("security.twoFactor.cancel")}
              </Button>
              <Button
                className={PRIMARY_BTN}
                onClick={() => setStep("password")}
                type="button"
              >
                {t("security.twoFactor.continue")}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "password" && (
          <>
            <div className="flex flex-col gap-2 py-1">
              <Label htmlFor={passwordFieldId}>
                {t("security.twoFactor.passwordLabel")}
              </Label>
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
                    ? t("security.twoFactor.enableHint")
                    : t("security.twoFactor.disableHint")}
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
                {mode === "enable"
                  ? t("security.twoFactor.back")
                  : t("security.twoFactor.cancel")}
              </Button>
              <Button
                className={PRIMARY_BTN}
                disabled={password.length === 0 || busy || lock.active}
                onClick={mode === "enable" ? continueEnable : continueDisable}
                type="button"
              >
                {passwordPending || sendingCode ? (
                  <>
                    {t("security.twoFactor.checking")}
                    <Loader2Icon className="size-4 animate-spin" />
                  </>
                ) : (
                  t("security.twoFactor.continue")
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
              <p className="font-medium text-base text-foreground">
                {t("security.twoFactor.successTitle")}
              </p>
              <p className="text-muted-foreground text-sm">
                <Trans
                  components={{ br: <br />, u: <span className="underline" /> }}
                  i18nKey="security.twoFactor.successText"
                  values={{ email: email ?? "" }}
                />
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
