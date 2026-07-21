import { auth } from "@contract-builder/auth";
import type { Context as HonoContext } from "hono";

export interface CreateContextOptions {
  context: HonoContext;
}

export async function createContext({ context }: CreateContextOptions) {
  const headers = context.req.raw.headers;
  const session = await auth.api.getSession({ headers });
  return {
    session,
    headers,
    // Заголовки ответа (например, set-cookie после смены пароля) — сервер
    // отдаёт их клиенту через responseMeta tRPC-адаптера.
    resHeaders: new Headers(),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
