import { useMutation } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

import {
  COUNTDOWN_TICK_MS,
  ErrorNote,
  formatCountdown,
  getNewPasswordState,
  NETWORK_ERROR,
  NewPasswordFields,
  OUTLINE_BTN,
  PasswordChangedSuccess,
  PasswordInput,
  PRIMARY_BTN,
} from "./password-dialog-shared";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";

const NO_PASSWORD_ERROR = "Для аккаунта не установлен пароль";

type Step = "current" | "new" | "success";

export function ChangePasswordDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const currentFieldId = useId();

  const [step, setStep] = useState<Step>("current");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const verifyMutation = useMutation(
    trpc.auth.verifyPassword.mutationOptions()
  );
  const changeMutation = useMutation(
    trpc.auth.changePassword.mutationOptions()
  );

  // Сбрасываем шаги и поля при каждом открытии; блокировка (lockedUntil)
  // переживает закрытие — на сервере она всё равно действует.
  useEffect(() => {
    if (open) {
      setStep("current");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrent(false);
      setCurrentError(null);
    }
  }, [open]);

  // Тикающий обратный отсчёт «Повторите через mm:ss».
  useEffect(() => {
    if (!lockedUntil) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  const lockRemainingSeconds = lockedUntil
    ? Math.max(0, Math.ceil((lockedUntil - now) / COUNTDOWN_TICK_MS))
    : 0;
  const locked = lockRemainingSeconds > 0;

  useEffect(() => {
    if (lockedUntil && !locked) {
      setLockedUntil(null);
    }
  }, [lockedUntil, locked]);

  const applyCheckFailure = (
    check:
      | { status: "no_password" }
      | { status: "invalid"; attemptsLeft: number }
      | { status: "locked"; retryAfterSeconds: number }
  ) => {
    if (check.status === "locked") {
      setNow(Date.now());
      setLockedUntil(Date.now() + check.retryAfterSeconds * COUNTDOWN_TICK_MS);
      setCurrentError(null);
      return;
    }
    if (check.status === "invalid") {
      setCurrentError(
        check.attemptsLeft === 1
          ? "Неверный пароль.\nОсталась одна попытка."
          : "Неверный пароль"
      );
      return;
    }
    setCurrentError(NO_PASSWORD_ERROR);
  };

  const handleContinue = async () => {
    try {
      const result = await verifyMutation.mutateAsync({
        password: currentPassword,
      });
      if (result.status === "ok") {
        setCurrentError(null);
        setStep("new");
        return;
      }
      applyCheckFailure(result);
    } catch {
      toast.error(NETWORK_ERROR);
    }
  };

  const handleSave = async () => {
    try {
      const result = await changeMutation.mutateAsync({
        currentPassword,
        newPassword,
      });
      if (result.status === "ok") {
        setStep("success");
        return;
      }
      if (result.status === "same_password") {
        // Клиент проверяет это заранее; сюда попадём только в редкой гонке.
        return;
      }
      // Текущий пароль перестал подходить (сменили в другой вкладке) или
      // блокировка — возвращаемся на первый шаг.
      setStep("current");
      setCurrentPassword("");
      applyCheckFailure(result);
    } catch {
      toast.error(NETWORK_ERROR);
    }
  };

  const { error: newStepError, canSave } = getNewPasswordState({
    newPassword,
    confirmPassword,
    mustDifferFrom: currentPassword,
  });

  const currentStepError = locked
    ? `Слишком много попыток.\nПовторите через ${formatCountdown(lockRemainingSeconds)}.`
    : currentError;

  // Пока запрос в полёте, диалог нельзя закрыть (крестик/Esc/клик вне),
  // иначе пароль сменится «в фоне», а экран успеха не покажется.
  const busy = verifyMutation.isPending || changeMutation.isPending;
  const guardClose = (event: Event) => {
    if (busy) {
      event.preventDefault();
    }
  };

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
        className="overflow-visible sm:max-w-md"
        onEscapeKeyDown={guardClose}
        onInteractOutside={guardClose}
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>Смена пароля</DialogTitle>
        </DialogHeader>

        {step === "current" && (
          <>
            <div className="flex flex-col gap-2 py-1">
              <Label htmlFor={currentFieldId}>Текущий пароль</Label>
              <PasswordInput
                autoComplete="current-password"
                id={currentFieldId}
                invalid={Boolean(currentStepError)}
                onChange={(value) => {
                  setCurrentPassword(value);
                  setCurrentError(null);
                }}
                onToggleShow={() => setShowCurrent((s) => !s)}
                show={showCurrent}
                value={currentPassword}
              />
              {currentStepError && <ErrorNote message={currentStepError} />}
            </div>
            <DialogFooter>
              <Button
                className={OUTLINE_BTN}
                disabled={verifyMutation.isPending}
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Отменить
              </Button>
              <Button
                className={PRIMARY_BTN}
                disabled={
                  currentPassword.length === 0 ||
                  verifyMutation.isPending ||
                  locked
                }
                onClick={handleContinue}
                type="button"
              >
                {verifyMutation.isPending ? "Проверяем..." : "Продолжить"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "new" && (
          <>
            <NewPasswordFields
              confirmPassword={confirmPassword}
              error={newStepError}
              newPassword={newPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onNewPasswordChange={setNewPassword}
            />
            <DialogFooter>
              <Button
                className={OUTLINE_BTN}
                disabled={changeMutation.isPending}
                onClick={() => setStep("current")}
                type="button"
                variant="outline"
              >
                Назад
              </Button>
              <Button
                className={PRIMARY_BTN}
                disabled={!canSave || changeMutation.isPending}
                onClick={handleSave}
                type="button"
              >
                {changeMutation.isPending ? (
                  <>
                    Сохраняем
                    <Loader2Icon className="size-4 animate-spin" />
                  </>
                ) : (
                  "Сохранить"
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "success" && <PasswordChangedSuccess />}
      </DialogContent>
    </Dialog>
  );
}
