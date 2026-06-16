import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { requireAdmin } from "@/lib/auth-guard";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
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

function AdminUsersPage() {
  const trpc = useTRPC();
  const { data: users = [], isLoading } = useQuery(
    trpc.admin.users.queryOptions()
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="shrink-0 border-b px-6 py-4">
        <h1 className="font-semibold text-lg">Пользователи</h1>
        <p className="text-muted-foreground text-sm">
          Все зарегистрированные пользователи ({users.length})
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
                    Имя
                  </th>
                  <th className="px-4 py-2 font-medium" scope="col">
                    Email
                  </th>
                  <th className="px-4 py-2 font-medium" scope="col">
                    Телефон
                  </th>
                  <th className="px-4 py-2 font-medium" scope="col">
                    Роль
                  </th>
                  <th className="px-4 py-2 font-medium" scope="col">
                    Регистрация
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-muted-foreground"
                      colSpan={5}
                    >
                      Нет пользователей
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr className="border-t" key={u.id}>
                      <td className="px-4 py-2 font-medium">{u.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {u.email ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {u.phoneNumber ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        {u.isAdmin ? (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
                            Админ
                          </span>
                        ) : (
                          "Пользователь"
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
