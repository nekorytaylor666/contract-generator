import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { readDownloadReturn } from "@/lib/download-return";

export const Route = createFileRoute("/fail/payment")({
  component: PaymentFail,
  validateSearch: (search: Record<string, unknown>): { invId?: number } => {
    const raw = search.invId ?? search.InvId;
    if (raw == null || raw === "") {
      return { invId: undefined };
    }
    const parsed = Number(raw);
    return { invId: Number.isNaN(parsed) ? undefined : parsed };
  },
});

function PaymentFail() {
  const { t } = useTranslation();
  const { invId } = Route.useSearch();
  const navigate = useNavigate();

  // Платёж начат из модалки скачивания на странице шаблона — возвращаем
  // пользователя туда: модалка откроется в состоянии «Не удалось провести
  // оплату» с кнопкой «Попробовать снова» (см. TemplateDownloadDialog).
  useEffect(() => {
    const stored = readDownloadReturn();
    if (!stored) {
      return;
    }
    if (stored.invId != null && invId != null && stored.invId !== invId) {
      return;
    }
    navigate({
      to: "/templates/$templateId",
      params: { templateId: stored.templateId },
      search: { payFailed: true, payInvId: invId ?? undefined },
      replace: true,
    });
  }, [invId, navigate]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <XCircle className="size-14 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-foreground text-xl">
          {t("payment.failTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("payment.failHint")}</p>
      </div>
      <Button asChild>
        <Link to="/templates">{t("payment.backToTemplates")}</Link>
      </Button>
    </div>
  );
}
