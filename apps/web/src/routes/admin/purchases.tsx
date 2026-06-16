import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PaginationControls } from "@/components/pagination-controls";
import { requireAdmin } from "@/lib/auth-guard";
import { useTRPC } from "@/utils/trpc";

const PAGE_SIZE = 25;

export const Route = createFileRoute("/admin/purchases")({
  component: AdminPurchasesPage,
  beforeLoad: async () => {
    const { session } = await requireAdmin();
    return { session };
  },
});

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function purposeLabel(purpose: string): string {
  if (purpose === "template_download") {
    return "Скачивание";
  }
  return "Редактирование";
}

const STATUS: Record<string, { label: string; className: string }> = {
  paid: { label: "Оплачено", className: "bg-green-50 text-green-700" },
  pending: { label: "Ожидание", className: "bg-amber-50 text-amber-700" },
  failed: { label: "Ошибка", className: "bg-red-50 text-red-700" },
};

function AdminPurchasesPage() {
  const trpc = useTRPC();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery(
    trpc.admin.purchases.queryOptions({ page, pageSize: PAGE_SIZE })
  );
  const purchases = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="shrink-0 border-b px-6 py-4">
        <h1 className="font-semibold text-lg">Купленные документы</h1>
        <p className="text-muted-foreground text-sm">
          Все покупки шаблонов ({total})
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Загрузка...</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground text-xs">
                <tr>
                  <th className="px-4 py-2 font-medium" scope="col">
                    Дата
                  </th>
                  <th className="px-4 py-2 font-medium" scope="col">
                    Пользователь
                  </th>
                  <th className="px-4 py-2 font-medium" scope="col">
                    Документ
                  </th>
                  <th className="px-4 py-2 font-medium" scope="col">
                    Тип
                  </th>
                  <th className="px-4 py-2 font-medium" scope="col">
                    Сумма
                  </th>
                  <th className="px-4 py-2 font-medium" scope="col">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-muted-foreground"
                      colSpan={6}
                    >
                      Покупок пока нет
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => {
                    const status = STATUS[p.status] ?? {
                      label: p.status,
                      className: "bg-muted text-muted-foreground",
                    };
                    return (
                      <tr className="border-t" key={p.id}>
                        <td className="px-4 py-2 text-muted-foreground">
                          {formatDate(p.createdAt)}
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium">{p.userName ?? "—"}</div>
                          <div className="text-muted-foreground text-xs">
                            {p.userEmail ?? ""}
                          </div>
                        </td>
                        <td className="px-4 py-2">{p.templateTitle ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {purposeLabel(p.purpose)}
                        </td>
                        <td className="px-4 py-2">
                          {p.amount.toLocaleString("ru-RU")} ₸
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4">
          <PaginationControls
            onPageChange={setPage}
            page={page}
            pageCount={pageCount}
          />
        </div>
      </div>
    </div>
  );
}
