import type { AppRouter } from "@contract-builder/api/routers/index";

import { env } from "@contract-builder/env/web";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

// Единственные экземпляры queryClient/tRPC-клиента на приложение. Живут
// отдельно от router.tsx, чтобы их могли использовать гварды роутов
// (auth-guard.ts) без циклического импорта через routeTree.
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      toast.error(error.message, {
        action: {
          label: "retry",
          onClick: query.invalidate,
        },
      });
    },
  }),
  defaultOptions: { queries: { staleTime: 60 * 1000 } },
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.VITE_SERVER_URL}/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});

// Тот же options-proxy, что отдаёт useTRPC() в компонентах — ключи запросов
// совпадают, поэтому данные, полученные в beforeLoad, попадают в общий кеш.
export const trpc = createTRPCOptionsProxy({
  client: trpcClient,
  queryClient,
});
