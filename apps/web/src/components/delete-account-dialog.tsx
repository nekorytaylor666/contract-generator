import { useMutation } from "@tanstack/react-query";
import { CheckIcon, CircleAlertIcon, Loader2Icon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

import {
  ErrorNote,
  NETWORK_ERROR,
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
const SUCCESS_REDIRECT_DELAY_MS = 5000;
const DESTRUCTIVE_BTN =
  "h-9 bg-destructive px-4 text-sm text-white hover:bg-destructive/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";
const INVALID_CODE_ERROR = "Неверный код";
const EXPIRED_CODE_ERROR = "Код устарел. Запросите новый.";
const TOO_MANY_ATTEMPTS_ERROR = "Слишком много попыток. Запросите новый код.";
const COOLDOWN_NO_CODE_ERROR =
  "Слишком часто. Подождите таймер и запросите код заново.";

type Step = "confirm" | "code" | "success";

const STEP_TITLES: Record<Step, string> = {
  confirm: "Удалить аккаунт?",
  code: "Подтверждение действия",
  success: "Удаление аккаунта",
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
  const trpc = useTRPC();
  const confirmFieldId = useId();
  const codeFieldId = useId();

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
        toast.error("У аккаунта не указаны ни почта, ни телефон");
        return;
      }
      resend.start(result.retryAfterSeconds);
      if (!result.sentTo) {
        // Кулдаун без живого кода — не ведём на шаг ввода.
        if (step === "code") {
          setCodeError(COOLDOWN_NO_CODE_ERROR);
        } else {
          toast.error(COOLDOWN_NO_CODE_ERROR);
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
      toast.error(NETWORK_ERROR);
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
          setCodeError(EXPIRED_CODE_ERROR);
          return;
        case "too_many_attempts":
          setCode("");
          setCodeError(TOO_MANY_ATTEMPTS_ERROR);
          return;
        default:
          setCode("");
          setCodeError(INVALID_CODE_ERROR);
      }
    } catch {
      toast.error(NETWORK_ERROR);
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
          <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
        </DialogHeader>

        {step === "confirm" && (
          <>
            <div className="flex flex-col gap-4 py-1">
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive p-4">
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-destructive text-sm">
                    Это действие необратимо
                  </p>
                  <p className="text-destructive text-sm">
                    Все ваши данные, договоры и история покупок на Zhebe.kz
                    будут удалены без возможности восстановления. Нам необходимо
                    подтвердить, что это вы собираетесь удалить аккаунт.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={confirmFieldId}>
                  {isEmail
                    ? "Для подтверждения введите почту"
                    : "Для подтверждения введите номер телефона"}
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
                Отменить
              </Button>
              <Button
                className={PRIMARY_BTN}
                disabled={!contactMatches || busy}
                onClick={sendCode}
                type="button"
              >
                {requestMutation.isPending ? (
                  <>
                    Отправляем
                    <Loader2Icon className="size-4 animate-spin" />
                  </>
                ) : (
                  "Подтвердить"
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "code" && (
          <>
            <div className="flex flex-col gap-4 py-1">
              <p className="text-foreground text-sm">
                Мы отправили код на <span className="underline">{sentTo}</span>
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
                    onChange={(e) => {
                      setCode(
                        e.target.value
                          .replace(NON_DIGIT_REGEX, "")
                          .slice(0, CODE_LENGTH)
                      );
                      setCodeError(null);
                    }}
                    placeholder="Введите код"
                    value={code}
                  />
                  <div className="absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                    {resend.active ? (
                      <span className="text-muted-foreground">
                        {resend.remainingSeconds} с.
                      </span>
                    ) : (
                      <button
                        className="text-foreground hover:underline disabled:opacity-60"
                        disabled={busy}
                        onClick={sendCode}
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
                onClick={() => setStep("confirm")}
                type="button"
                variant="outline"
              >
                Назад
              </Button>
              <Button
                className={DESTRUCTIVE_BTN}
                disabled={!CODE_REGEX.test(code) || busy}
                onClick={confirmDeletion}
                type="button"
              >
                {confirmMutation.isPending ? (
                  <>
                    Удаляем
                    <Loader2Icon className="size-4 animate-spin" />
                  </>
                ) : (
                  "Удалить аккаунт"
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
                Аккаунт успешно удалён!
              </p>
              <p className="text-muted-foreground text-sm">
                Вы будете перенаправлены на главную страницу в течение 5 секунд.
                Если этого не произошло, нажмите на кнопку.
              </p>
            </div>
            <Button className={PRIMARY_BTN} onClick={goHome} type="button">
              На главную
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
