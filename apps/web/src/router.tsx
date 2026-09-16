import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import Loader from "./components/loader";
import { queryClient, trpc, trpcClient } from "./lib/trpc-client";
import { routeTree } from "./routeTree.gen";
import { TRPCProvider } from "./utils/trpc";

export const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: { trpc, queryClient },
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    // Ошибка роут-компонента не должна оставлять пустой экран — показываем
    // текст ошибки и кнопку перезагрузки.
    defaultErrorComponent: ({ error }) => (
      <div className="flex h-full min-h-[50vh] items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <p className="font-semibold text-destructive">
            Произошла ошибка при отображении страницы
          </p>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-left text-muted-foreground text-xs">
            {error.message}
          </pre>
          <button
            className="mt-4 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            onClick={() => window.location.reload()}
            type="button"
          >
            Перезагрузить страницу
          </button>
        </div>
      </div>
    ),
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
          {children}
        </TRPCProvider>
      </QueryClientProvider>
    ),
  });
  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
