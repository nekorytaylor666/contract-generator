import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Loader2, Mail, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  OUTLINE_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  StatusView,
} from "@/components/template-modal-shared";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/utils/trpc";

export interface LawyerReviewPayload {
  templateId: string;
  documentId?: string;
  locale?: string;
  variables: Record<string, unknown>;
  logo?: string;
  style?: { font?: string; preset?: string };
}

/** Иллюстрация по макету: документ → письмо → готовое заключение. */
function ReviewIllustration() {
  return (
    <div aria-hidden="true" className="flex items-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[#ffe2e2]">
        <FileText className="size-7 text-[#c96a5a]" />
      </div>
      <span className="w-3 border-[#d4d4d4] border-t border-dashed" />
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-background">
        <Mail className="size-4 text-foreground" />
      </span>
      <span className="w-3 border-[#d4d4d4] border-t border-dashed" />
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[#dcfce7]">
        <span className="flex size-8 items-center justify-center rounded-full bg-background">
          <Check className="size-5 text-[#16a34a]" />
        </span>
      </div>
    </div>
  );
}

/**
 * Модалка «Отправить договор на проверку?» (по макету): юрист компании получит
 * текущую версию договора с данными клиента на рабочую почту; после отправки —
 * экран «Договор отправлен» с почтой, на которую придёт заключение.
 */
export function LawyerReviewDialog({
  open,
  onOpenChange,
  buildPayload,
  userEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Текущие значения конструктора; null — форма ещё не готова. */
  buildPayload: () => LawyerReviewPayload | null;
  userEmail: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [sent, setSent] = useState(false);

  const sendMutation = useMutation(
    trpc.templates.sendToLawyer.mutationOptions({
      onSuccess: () => {
        // Квота проверок списана — обновляем «Использование» и кнопку в шапке.
        queryClient.invalidateQueries(
          trpc.subscriptions.mySubscription.queryFilter()
        );
        setSent(true);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  // Повторное открытие — снова экран подтверждения.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSent(false);
    }
    wasOpenRef.current = open;
  }, [open]);

  const handleSend = () => {
    const payload = buildPayload();
    if (!payload) {
      return;
    }
    sendMutation.mutate(payload);
  };

  const sending = sendMutation.isPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex flex-col gap-0 overflow-hidden rounded-[10px] border-[#e5e5e5] p-0 sm:max-w-[320px]"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between border-[#e5e5e5] border-b p-4">
          <DialogTitle className="font-medium text-base leading-5">
            {sent ? "Договор отправлен" : "Отправить договор на проверку?"}
          </DialogTitle>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-6 items-center justify-center rounded-md text-foreground outline-none hover:bg-muted"
          >
            <X className="size-4" />
          </DialogClose>
        </DialogHeader>

        {sent ? (
          <StatusView
            hint={`Ответ придёт на ${userEmail}`}
            title="Договор отправлен на проверку!"
            tone="success"
          />
        ) : (
          <>
            <div className="flex flex-col items-center gap-5 px-6 pt-8 pb-2">
              <ReviewIllustration />
              <p className="max-w-[260px] text-center text-muted-foreground text-sm leading-[18px]">
                Юрист получит текущую версию договора и пришлёт заключение на
                вашу почту — обычно в течение 1–2 рабочих дней.
              </p>
            </div>
            <div className="flex justify-center gap-2 p-6">
              <DialogClose
                className={OUTLINE_BUTTON_CLASS}
                disabled={sending}
                type="button"
              >
                Отменить
              </DialogClose>
              <button
                className={PRIMARY_BUTTON_CLASS}
                disabled={sending}
                onClick={handleSend}
                type="button"
              >
                {sending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {sending ? "Отправляем" : "Отправить"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
