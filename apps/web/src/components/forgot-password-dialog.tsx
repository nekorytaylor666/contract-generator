import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
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
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const CODE_LENGTH = 6;
const CODE_REGEX = /^\d{6}$/;
const NON_DIGIT_REGEX = /\D/g;
const MILLIS_PER_SECOND = 1000;
const NO_IDENTIFIER_ERROR = "В профиле не указаны почта и телефон";
const INVALID_CODE_ERROR = "Неверный код.";
const EXPIRED_CODE_ERROR = "Код устарел. Запросите новый.";
const TOO_MANY_ATTEMPTS_ERROR = "Слишком много попыток. Запросите новый код.";

type Step = "method" | "code" | "new" | "success";
type Channel = "email" | "phone";

function defaultChannel(hasEmail: boolean, hasPhone: boolean): Channel | null {
  if (hasEmail) {
    return "email";
  }
  if (hasPhone) {
    return "phone";
  }
  return null;
}

function ChannelOption({
  title,
  identifier,
  selected,
  onSelect,
}: {
  title: string;
  identifier: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left",
        selected ? "border-foreground" : "border-border"
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-foreground text-sm">{title}</span>
        <span className="truncate text-muted-foreground text-sm">
          {identifier}
        </span>
      </span>
      {selected && <CheckIcon className="size-4 shrink-0" />}
    </button>
  );
}

function MethodStep({
  email,
  phoneNumber,
  loaded,
  channel,
  onChannelChange,
  onCancel,
  onSend,
  sending,
}: {
  email: string | null;
  phoneNumber: string | null;
  loaded: boolean;
  channel: Channel | null;
  onChannelChange: (channel: Channel) => void;
  onCancel: () => void;
  onSend: () => void;
  sending: boolean;
}) {
  return (
    <>
      <div className="flex flex-col gap-3 py-1">
        <p className="text-muted-foreground text-sm">
          Куда отправить код подтверждения?
        </p>
        {email && (
          <ChannelOption
            identifier={email}
            onSelect={() => onChannelChange("email")}
            selected={channel === "email"}
            title="Код на почту"
          />
        )}
        {phoneNumber && (
          <ChannelOption
            identifier={phoneNumber}
            onSelect={() => onChannelChange("phone")}
            selected={channel === "phone"}
            title="Код по SMS"
          />
        )}
        {loaded && !(email || phoneNumber) && (
          <ErrorNote message={NO_IDENTIFIER_ERROR} />
        )}
      </div>
      <DialogFooter>
        <Button
          className={OUTLINE_BTN}
          disabled={sending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Отменить
        </Button>
        <Button
          className={PRIMARY_BTN}
          disabled={!channel || sending}
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
  onContinue,
}: {
  destination: string;
  code: string;
  onCodeChange: (code: string) => void;
  codeError: string | null;
  resendRemainingSeconds: number;
  resendDisabled: boolean;
  onResend: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const codeFieldId = useId();
  return (
    <>
      <div className="flex flex-col gap-2 py-1">
        <Label htmlFor={codeFieldId}>Код отправлен на {destination}</Label>
        <Input
          autoComplete="one-time-code"
          className={cn(
            "h-10 rounded-lg border-border bg-background px-4 text-sm",
            codeError && "border-destructive"
          )}
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
          onClick={onBack}
          type="button"
          variant="outline"
        >
          Назад
        </Button>
        <Button
          className={PRIMARY_BTN}
          disabled={!CODE_REGEX.test(code)}
          onClick={onContinue}
          type="button"
        >
          Продолжить
        </Button>
      </DialogFooter>
    </>
  );
}

export function ForgotPasswordDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const { data: me } = useQuery(trpc.account.me.queryOptions());

  const [step, setStep] = useState<Step>("method");
  const [channel, setChannel] = useState<Channel | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(
    null
  );
  const [now, setNow] = useState(() => Date.now());
  // Канал по умолчанию выставляем один раз за открытие (когда подгрузится me),
  // чтобы рефетч me не сбрасывал выбор пользователя посреди флоу.
  const channelInitialized = useRef(false);

  const requestMutation = useMutation(
    trpc.auth.requestPasswordResetCode.mutationOptions()
  );
  const resetMutation = useMutation(
    trpc.auth.resetPasswordWithCode.mutationOptions()
  );

  const hasEmail = Boolean(me?.email);
  const hasPhone = Boolean(me?.phoneNumber);

  // Полный сброс при каждом открытии.
  useEffect(() => {
    if (open) {
      setStep("method");
      setChannel(null);
      setCode("");
      setCodeError(null);
      setNewPassword("");
      setConfirmPassword("");
      channelInitialized.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (open && !channelInitialized.current && me) {
      setChannel(defaultChannel(hasEmail, hasPhone));
      channelInitialized.current = true;
    }
  }, [open, me, hasEmail, hasPhone]);

  // Тикающий таймер «Отправить ещё раз через mm:ss».
  useEffect(() => {
    if (!resendAvailableAt) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, [resendAvailableAt]);

  const resendRemainingSeconds = resendAvailableAt
    ? Math.max(0, Math.ceil((resendAvailableAt - now) / COUNTDOWN_TICK_MS))
    : 0;

  useEffect(() => {
    if (resendAvailableAt && resendRemainingSeconds === 0) {
      setResendAvailableAt(null);
    }
  }, [resendAvailableAt, resendRemainingSeconds]);

  const selectChannel = (next: Channel) => {
    setChannel(next);
    // Код привязан к каналу — при смене канала старый код неактуален.
    setCode("");
    setCodeError(null);
  };

  const sendCode = async () => {
    if (!channel) {
      return;
    }
    try {
      const result = await requestMutation.mutateAsync({ channel });
      if (result.status === "no_identifier") {
        toast.error(NO_IDENTIFIER_ERROR);
        return;
      }
      setNow(Date.now());
      setResendAvailableAt(
        Date.now() + result.retryAfterSeconds * MILLIS_PER_SECOND
      );
      if (result.status === "sent") {
        // Пришёл новый код — очищаем поле от прежнего ввода.
        setCode("");
        setCodeError(null);
      }
      // status "cooldown": новый код НЕ отправлен, но прежний ещё жив —
      // просто показываем шаг ввода и таймер, ничего не очищая.
      setStep("code");
    } catch {
      toast.error(NETWORK_ERROR);
    }
  };

  const backToCodeWithError = (message: string) => {
    setCode("");
    setCodeError(message);
    setStep("code");
  };

  const handleSave = async () => {
    if (!(channel && CODE_REGEX.test(code))) {
      return;
    }
    try {
      const result = await resetMutation.mutateAsync({
        channel,
        code,
        newPassword,
      });
      switch (result.status) {
        case "ok":
          setStep("success");
          return;
        case "invalid_code":
          backToCodeWithError(INVALID_CODE_ERROR);
          return;
        case "code_expired":
          backToCodeWithError(EXPIRED_CODE_ERROR);
          return;
        case "too_many_attempts":
          backToCodeWithError(TOO_MANY_ATTEMPTS_ERROR);
          return;
        default:
          toast.error(NO_IDENTIFIER_ERROR);
      }
    } catch {
      toast.error(NETWORK_ERROR);
    }
  };

  const { error: passwordError, canSave } = getNewPasswordState({
    newPassword,
    confirmPassword,
  });

  const busy = requestMutation.isPending || resetMutation.isPending;
  const guardClose = (event: Event) => {
    if (busy) {
      event.preventDefault();
    }
  };

  const destination =
    channel === "email"
      ? `почту ${me?.email ?? ""}`
      : `номер ${me?.phoneNumber ?? ""}`;

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
          <DialogTitle>Восстановление пароля</DialogTitle>
        </DialogHeader>

        {step === "method" && (
          <MethodStep
            channel={channel}
            email={me?.email ?? null}
            loaded={Boolean(me)}
            onCancel={onClose}
            onChannelChange={selectChannel}
            onSend={sendCode}
            phoneNumber={me?.phoneNumber ?? null}
            sending={requestMutation.isPending}
          />
        )}

        {step === "code" && (
          <CodeStep
            code={code}
            codeError={codeError}
            destination={destination}
            onBack={() => setStep("method")}
            onCodeChange={(value) => {
              setCode(value);
              setCodeError(null);
            }}
            onContinue={() => setStep("new")}
            onResend={sendCode}
            resendDisabled={
              resendRemainingSeconds > 0 || requestMutation.isPending
            }
            resendRemainingSeconds={resendRemainingSeconds}
          />
        )}

        {step === "new" && (
          <>
            <NewPasswordFields
              confirmPassword={confirmPassword}
              error={passwordError}
              newPassword={newPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onNewPasswordChange={setNewPassword}
            />
            <DialogFooter>
              <Button
                className={OUTLINE_BTN}
                disabled={resetMutation.isPending}
                onClick={() => setStep("code")}
                type="button"
                variant="outline"
              >
                Назад
              </Button>
              <Button
                className={PRIMARY_BTN}
                disabled={!canSave || resetMutation.isPending}
                onClick={handleSave}
                type="button"
              >
                {resetMutation.isPending ? (
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
