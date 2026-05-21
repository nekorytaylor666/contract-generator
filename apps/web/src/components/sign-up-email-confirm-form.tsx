import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

const OTP_LENGTH = 6;
const STUB_CODE = "111111";

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (local.length <= 2) {
    return `${local}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-2)}@${domain}`;
}

export function SignUpEmailConfirmForm({
  email,
  onChangeEmail,
  onVerified,
}: {
  email: string;
  onChangeEmail: () => void;
  onVerified: () => void;
}) {
  // Один input на каждый знак, плюс ref на первый — авто-фокус при монтаже.
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: OTP_LENGTH }, () => "")
  );
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  function setDigit(index: number, value: string) {
    const sanitized = value.replace(/\D/g, "").slice(0, 1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = sanitized;
      return next;
    });
    if (sanitized && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array.from({ length: OTP_LENGTH }, (_, i) => pasted[i] ?? "");
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function submit(code: string) {
    if (code.length !== OTP_LENGTH) return;
    setIsSubmitting(true);
    // Dev-stub: код всегда "111111". Заменить на authClient.emailOtp.verify
    // когда подключим SMTP/email-провайдера.
    if (code === STUB_CODE) {
      onVerified();
    } else {
      toast.error(`Неверный код. Используйте ${STUB_CODE}`);
      setDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      inputsRef.current[0]?.focus();
    }
    setIsSubmitting(false);
  }

  const code = digits.join("");

  // Авто-submit когда все 6 заполнены.
  useEffect(() => {
    if (code.length === OTP_LENGTH && !isSubmitting) {
      submit(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function resend() {
    toast.info(`Тестовый код: ${STUB_CODE}`);
    setDigits(Array.from({ length: OTP_LENGTH }, () => ""));
    inputsRef.current[0]?.focus();
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-6">
        <div className="font-bold text-3xl text-foreground">A</div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-medium text-3xl text-foreground">
            Подтвердите электронную почту
          </h1>
          <p className="max-w-[380px] text-base text-foreground/80">
            Мы отправили 6-значный код на{" "}
            <span className="text-foreground">{maskEmail(email)}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex">
          {digits.map((d, i) => (
            <input
              autoComplete={i === 0 ? "one-time-code" : "off"}
              className={cn(
                "size-[60px] border border-border bg-background text-center font-medium text-foreground text-lg outline-none transition-colors focus:border-foreground",
                i === 0 && "rounded-l-lg",
                i === OTP_LENGTH - 1 && "rounded-r-lg",
                i > 0 && "-ml-px"
              )}
              inputMode="numeric"
              key={`otp-${
                // biome-ignore lint/suspicious/noArrayIndexKey: индексы стабильны — длина массива фиксирована.
                i
              }`}
              maxLength={1}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={handlePaste}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              type="text"
              value={d}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm">Не та почта?</span>
          <button
            className="text-primary text-sm hover:underline"
            onClick={onChangeEmail}
            type="button"
          >
            Изменить адрес
          </button>
        </div>
      </div>

      <p className="max-w-[380px] text-center text-foreground/80 text-sm">
        Не нашли письмо? Проверьте папку «Спам» или{" "}
        <button className="underline" onClick={resend} type="button">
          переслать код
        </button>
      </p>
    </div>
  );
}
