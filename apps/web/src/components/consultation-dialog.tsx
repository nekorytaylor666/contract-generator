import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/utils/trpc";

interface ConsultationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Зеркало серверной проверки телефона (consultations.submit): цифры, +,
// скобки, пробелы и дефисы; минимум 10 цифр.
const PHONE_CHARS_RE = /^[\d\s()+-]+$/;
const NON_DIGIT_RE = /\D/g;
const MIN_PHONE_DIGITS = 10;

function isValidPhone(value: string): boolean {
  return (
    PHONE_CHARS_RE.test(value.trim()) &&
    value.replace(NON_DIGIT_RE, "").length >= MIN_PHONE_DIGITS
  );
}

// Zod-ошибки tRPC приходят строкой с JSON-массивом issues — показываем
// первое сообщение, а не сырой JSON.
function humanizeServerError(raw: string): string {
  if (!raw.trimStart().startsWith("[")) {
    return raw;
  }
  try {
    const issues = JSON.parse(raw) as { message?: string }[];
    return issues[0]?.message ?? raw;
  } catch {
    return raw;
  }
}

/**
 * Форма «Получить консультацию» с лендинга: телефон, почта и текст запроса
 * уходят письмом менеджеру (consultations.submit). После успешной отправки
 * диалог показывает подтверждение; форма сбрасывается при закрытии.
 */
export function ConsultationDialog({
  open,
  onOpenChange,
}: ConsultationDialogProps) {
  const { t } = useTranslation();
  const trpc = useTRPC();
  const phoneId = useId();
  const emailId = useId();
  const messageId = useId();

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [phoneError, setPhoneError] = useState(false);

  const submitMut = useMutation(trpc.consultations.submit.mutationOptions());

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      // Сброс после закрытия: и полей, и состояния «отправлено»/ошибки.
      setPhone("");
      setEmail("");
      setMessage("");
      setPhoneError(false);
      submitMut.reset();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitMut.isPending) {
      return;
    }
    if (!isValidPhone(phone)) {
      setPhoneError(true);
      return;
    }
    setPhoneError(false);
    submitMut.mutate({ phone, email, message });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {submitMut.isSuccess ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 aria-hidden className="size-12 text-green-600" />
            <DialogHeader>
              <DialogTitle>{t("about.consultDialog.successTitle")}</DialogTitle>
              <DialogDescription>
                {t("about.consultDialog.successText")}
              </DialogDescription>
            </DialogHeader>
            <Button
              className="w-full"
              onClick={() => handleOpenChange(false)}
              type="button"
            >
              {t("about.consultDialog.close")}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("about.consultDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("about.consultDialog.description")}
              </DialogDescription>
            </DialogHeader>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={phoneId}>
                  {t("about.consultDialog.phone")}
                </Label>
                <Input
                  aria-invalid={phoneError || undefined}
                  autoComplete="tel"
                  id={phoneId}
                  inputMode="tel"
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPhoneError(false);
                  }}
                  placeholder={t("about.consultDialog.phonePlaceholder")}
                  required
                  type="tel"
                  value={phone}
                />
                {phoneError && (
                  <p className="text-destructive text-sm" role="alert">
                    {t("about.consultDialog.phoneInvalid")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={emailId}>
                  {t("about.consultDialog.email")}
                </Label>
                <Input
                  autoComplete="email"
                  id={emailId}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("about.consultDialog.emailPlaceholder")}
                  required
                  type="email"
                  value={email}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={messageId}>
                  {t("about.consultDialog.message")}
                </Label>
                <Textarea
                  className="min-h-24"
                  id={messageId}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("about.consultDialog.messagePlaceholder")}
                  required
                  value={message}
                />
              </div>
              {submitMut.isError && (
                <p className="text-destructive text-sm" role="alert">
                  {humanizeServerError(submitMut.error.message)}
                </p>
              )}
              <Button
                className="w-full"
                disabled={submitMut.isPending}
                type="submit"
              >
                {submitMut.isPending
                  ? t("about.consultDialog.sending")
                  : t("about.consultDialog.submit")}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
