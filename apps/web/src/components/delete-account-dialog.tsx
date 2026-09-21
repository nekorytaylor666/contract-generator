import { useMutation } from "@tanstack/react-query";
import { CheckIcon, CircleAlertIcon, Loader2Icon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

import {
  ErrorNote,
  OUTLINE_BTN,
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
const MILLIS_PER_SECOND = 1000;
const SUCCESS_REDIRECT_DELAY_MS = 5000;
const SUCCESS_REDIRECT_DELAY_SECONDS =
  SUCCESS_REDIRECT_DELAY_MS / MILLIS_PER_SECOND;
const DESTRUCTIVE_BTN =
  "h-9 bg-destructive px-4 text-sm text-white hover:bg-destructive/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";

type Step = "confirm" | "code" | "success";

const STEP_TITLE_KEYS: Record<Step, string> = {
  confirm: "account.deleteAccount.titleConfirm",
  code: "account.deleteAccount.titleCode",
  success: "account.deleteAccount.titleSuccess",
};

/**
 * Диалог удаления аккаунта: подтверждение вводом своей почты (или телефона,
 * если почты нет) → код на этот контакт → успех с редиректом на главную.
 */
export function DeleteAccountDialog({
  open,
  onClose,
  email,
  phoneNumber,
}: {
  open: boolean;
  onClose: () => void;
  email: string | null;
  phoneNumber: string | null;
}) {
  const { t } = useTranslation();
  const trpc = useTRPC();
  const confirmFieldId = useId();
  const codeFieldId = useId();
  const networkError = t("account.deleteAccount.networkError");
  const cooldownNoCodeError = t("account.deleteAccount.cooldownNoCode");

  const [step, setStep] = useState<Step>("confirm");
  const [contactInput, setContactInput] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const resend = useCountdown();

  const requestMutation = useMutation(
    trpc.account.requestDeleteCode.mutationOptions()
  );
  const confirmMutation = useMutation(
    trpc.account.confirmDeleteAccount.mutationOptions()
  );

  useEffect(() => {
    if (open) {
      setStep("confirm");
      setContactInput("");
      setCode("");
      setCodeError(null);
      setSentTo("");
    }
  }, [open]);

  // После удаления сессии больше нет — уводим на главную сами через 5 секунд.
  useEffect(() => {
    if (step !== "success") {
      return;
    }
    const timer = setTimeout(() => {
      window.location.href = "/";
    }, SUCCESS_REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [step]);

  const goHome = () => {
    window.location.href = "/";
  };

  // Подтверждение почтой; телефоном — только если почты нет.
  const isEmail = Boolean(email);
  const contact = email ?? phoneNumber;
  const contactMatches = isEmail
    ? contactInput.trim().toLowerCase() === (email ?? "").toLowerCase()
    : Boolean(phoneNumber) &&
      contactInput.replace(NON_DIGIT_REGEX, "") ===
        (phoneNumber ?? "").replace(NON_DIGIT_REGEX, "");

  const sendCode = async () => {
    try {
      const result = await requestMutation.mutateAsync();
      if (result.status === "no_contact") {
        toast.error(t("account.deleteAccount.noContact"));
        return;
      }
      resend.start(result.retryAfterSeconds);
      if (!result.sentTo) {
        // Кулдаун без живого кода — не ведём на шаг ввода.
        if (step === "code") {
          setCodeError(cooldownNoCodeError);
        } else {
          toast.error(cooldownNoCodeError);
        }
        return;
      }
      setSentTo(result.sentTo);
      if (result.status === "sent") {
        setCode("");
        setCodeError(null);
      }
      setStep("code");
    } catch {
      toast.error(networkError);
    }
  };

  const confirmDeletion = async () => {
    if (!CODE_REGEX.test(code)) {
      return;
    }
    try {
      const result = await confirmMutation.mutateAsync({ code });
      switch (result.status) {
        case "ok":
          setStep("success");
          return;
        case "code_expired":
          setCode("");
          setCodeError(t("account.deleteAccount.codeExpired"));
          return;
        case "too_many_attempts":
          setCode("");
          setCodeError(t("account.deleteAccount.tooManyAttempts"));
          return;
        default:
          setCode("");
          setCodeError(t("account.deleteAccount.invalidCode"));
      }
    } catch {
      toast.error(networkError);
    }
  };

  const busy = requestMutation.isPending || confirmMutation.isPending;
  const guardClose = (event: Event) => {
    if (busy) {
      event.preventDefault();
    }
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (next || busy) {
          return;
        }
        // После успешного удаления закрытие тоже уводит на главную.
        if (step === "success") {
          goHome();
          return;
        }
        onClose();
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
          <DialogTitle>{t(STEP_TITLE_KEYS[step])}</DialogTitle>
        </DialogHeader>

        {step === "confirm" && (
          <>
            <div className="flex flex-col gap-4 py-1">
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive p-4">
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-destructive text-sm">
                    {t("account.deleteAccount.irreversible")}
                  </p>
                  <p className="text-destructive text-sm">
                    {t("account.deleteAccount.warning")}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={confirmFieldId}>
                  {isEmail
                    ? t("account.deleteAccount.confirmEmailLabel")
                    : t("account.deleteAccount.confirmPhoneLabel")}
                </Label>
                <Input
                  autoComplete="off"
                  id={confirmFieldId}
                  onChange={(e) => setContactInput(e.target.value)}
                  placeholder={contact ?? ""}
                  type={isEmail ? "email" : "tel"}
                  value={contactInput}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className={OUTLINE_BTN}
                disabled={busy}
                onClick={onClose}
                type="button"
                variant="outline"
              >
                {t("account.deleteAccount.cancel")}
              </Button>
              <Button
                className={PRIMARY_BTN}
                disabled={!contactMatches || busy}
                onClick={sendCode}
                type="button"
              >
                {requestMutation.isPending ? (
                  <>
                    {t("account.deleteAccount.sending")}
                    <Loader2Icon className="size-4 animate-spin" />
                  </>
                ) : (
                  t("account.deleteAccount.confirm")
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "code" && (
          <>
            <div className="flex flex-col gap-4 py-1">
              <p className="text-foreground text-sm">
                <Trans
                  components={{ u: <span className="underline" /> }}
                  i18nKey="account.deleteAccount.codeSentTo"
                  values={{ contact: sentTo }}
                />
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor={codeFieldId}>
                  {t("account.deleteAccount.codeLabel")}
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
                    onChange={(e) => {
                      setCode(
                        e.target.value
                          .replace(NON_DIGIT_REGEX, "")
                          .slice(0, CODE_LENGTH)
                      );
                      setCodeError(null);
                    }}
                    placeholder={t("account.deleteAccount.codePlaceholder")}
                    value={code}
                  />
                  <div className="absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                    {resend.active ? (
                      <span className="text-muted-foreground">
                        {t("account.deleteAccount.resendSeconds", {
                          seconds: resend.remainingSeconds,
                        })}
                      </span>
                    ) : (
                      <button
                        className="text-foreground hover:underline disabled:opacity-60"
                        disabled={busy}
                        onClick={sendCode}
                        type="button"
                      >
                        {t("account.deleteAccount.resend")}
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
                onClick={() => setStep("confirm")}
                type="button"
                variant="outline"
              >
                {t("account.deleteAccount.back")}
              </Button>
              <Button
                className={DESTRUCTIVE_BTN}
                disabled={!CODE_REGEX.test(code) || busy}
                onClick={confirmDeletion}
                type="button"
              >
                {confirmMutation.isPending ? (
                  <>
                    {t("account.deleteAccount.deleting")}
                    <Loader2Icon className="size-4 animate-spin" />
                  </>
                ) : (
                  t("account.deleteAccount.deleteAccount")
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-green-100">
              <CheckIcon className="size-6 text-green-700" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium text-base text-foreground">
                {t("account.deleteAccount.successTitle")}
              </p>
              <p className="text-muted-foreground text-sm">
                {t("account.deleteAccount.successDescription", {
                  seconds: SUCCESS_REDIRECT_DELAY_SECONDS,
                })}
              </p>
            </div>
            <Button className={PRIMARY_BTN} onClick={goHome} type="button">
              {t("account.deleteAccount.goHome")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
