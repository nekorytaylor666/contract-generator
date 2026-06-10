import { createFileRoute, Link } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/fail/payment")({
  component: PaymentFail,
  validateSearch: (search: Record<string, unknown>): { invId?: number } => ({
    invId: search.invId ? Number(search.invId) : undefined,
  }),
});

function PaymentFail() {
  const { t } = useTranslation();

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
