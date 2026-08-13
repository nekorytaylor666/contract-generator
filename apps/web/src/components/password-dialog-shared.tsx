import { CheckIcon, CircleAlertIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { cn } from "@/lib/utils";

import {
  PASSWORD_REQUIREMENTS,
  PasswordRequirementsTooltip,
} from "./sign-up-password-form";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

// Общие детали диалогов «Смена пароля» и «Забыли пароль?» (профиль).

export const OUTLINE_BTN = "h-9 px-4 text-sm";
export const PRIMARY_BTN =
  "h-9 bg-foreground px-4 text-background text-sm hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";
export const NETWORK_ERROR = "Не удалось выполнить запрос. Попробуйте ещё раз.";
export const COUNTDOWN_TICK_MS = 1000;
const SECONDS_PER_MINUTE = 60;

export function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % SECONDS_PER_MINUTE)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const MILLIS_PER_SECOND = 1000;

/** Тикающий обратный отсчёт; после нуля сбрасывается сам. */
export function useCountdown(): {
  remainingSeconds: number;
  active: boolean;
  start: (seconds: number) => void;
} {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!until) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, [until]);

  const remainingSeconds = until
    ? Math.max(0, Math.ceil((until - now) / MILLIS_PER_SECOND))
    : 0;

  useEffect(() => {
    if (until && remainingSeconds === 0) {
      setUntil(null);
    }
  }, [until, remainingSeconds]);

  const start = (seconds: number) => {
    setNow(Date.now());
    setUntil(Date.now() + seconds * MILLIS_PER_SECOND);
  };

  return { remainingSeconds, active: remainingSeconds > 0, start };
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-1.5 text-destructive text-sm">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
      <p className="whitespace-pre-line text-left">{message}</p>
    </div>
  );
}

export function PasswordInput({
  id,
  value,
  onChange,
  invalid,
  show,
  onToggleShow,
  autoComplete,
  onFocus,
  onBlur,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  show: boolean;
  onToggleShow: () => void;
  autoComplete: string;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <div className="relative">
      <Input
        autoComplete={autoComplete}
        className={cn(
          "h-10 rounded-lg border-border bg-background px-4 pr-12 text-sm",
          invalid && "border-destructive"
        )}
        id={id}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder="********"
        type={show ? "text" : "password"}
        value={value}
      />
      <button
        className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={onToggleShow}
        type="button"
      >
        {show ? (
          <EyeOffIcon className="size-4" />
        ) : (
          <EyeIcon className="size-4" />
        )}
      </button>
    </div>
  );
}

/**
 * Клиентская валидация пары «новый пароль + подтверждение».
 * `mustDifferFrom` — известный текущий пароль (только в диалоге смены).
 */
export function getNewPasswordState({
  newPassword,
  confirmPassword,
  mustDifferFrom,
}: {
  newPassword: string;
  confirmPassword: string;
  mustDifferFrom?: string;
}): { error: string | null; canSave: boolean } {
  const requirementsMet = PASSWORD_REQUIREMENTS.every((r) =>
    r.test(newPassword)
  );
  const bothFilled = newPassword.length > 0 && confirmPassword.length > 0;
  const sameAsCurrent =
    mustDifferFrom !== undefined &&
    newPassword.length > 0 &&
    newPassword === mustDifferFrom;
  const mismatch = bothFilled && newPassword !== confirmPassword;

  let error: string | null = null;
  if (sameAsCurrent) {
    error = "Новый пароль совпадает с текущим";
  } else if (mismatch) {
    error = "Пароли не совпадают";
  }
  return {
    error,
    canSave: requirementsMet && bothFilled && !error,
  };
}

/** Поля «Новый пароль» и «Подтвердите пароль» с тултипом требований. */
export function NewPasswordFields({
  newPassword,
  confirmPassword,
  onNewPasswordChange,
  onConfirmPasswordChange,
  error,
}: {
  newPassword: string;
  confirmPassword: string;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  error: string | null;
}) {
  const newFieldId = useId();
  const confirmFieldId = useId();
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex flex-col gap-4 py-1">
      <div className="relative flex flex-col gap-2">
        <Label htmlFor={newFieldId}>Новый пароль</Label>
        <PasswordInput
          autoComplete="new-password"
          id={newFieldId}
          invalid={Boolean(error)}
          onBlur={() => setFocused(false)}
          onChange={onNewPasswordChange}
          onFocus={() => setFocused(true)}
          onToggleShow={() => setShowNew((s) => !s)}
          show={showNew}
          value={newPassword}
        />
        {focused && <PasswordRequirementsTooltip value={newPassword} />}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={confirmFieldId}>Подтвердите пароль</Label>
        <PasswordInput
          autoComplete="new-password"
          id={confirmFieldId}
          invalid={Boolean(error)}
          onChange={onConfirmPasswordChange}
          onToggleShow={() => setShowConfirm((s) => !s)}
          show={showConfirm}
          value={confirmPassword}
        />
        {error && <ErrorNote message={error} />}
      </div>
    </div>
  );
}

/** Финальный экран «Пароль изменён!» — общий для обоих диалогов. */
export function PasswordChangedSuccess() {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-green-100">
        <CheckIcon className="size-6 text-green-700" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-base text-foreground">Пароль изменён!</p>
        <p className="text-muted-foreground text-sm">
          Используйте новый пароль
          <br />
          для входа в аккаунт
        </p>
      </div>
    </div>
  );
}
