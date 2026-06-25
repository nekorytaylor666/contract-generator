import { devToolsMiddleware } from "@ai-sdk/devtools";
import { google } from "@ai-sdk/google";
import { createContext } from "@contract-builder/api/context";
import { processRobokassaResult } from "@contract-builder/api/lib/payment-service";
import { verifySuccessSignature } from "@contract-builder/api/lib/robokassa";
import { appRouter } from "@contract-builder/api/routers/index";
import { auth } from "@contract-builder/auth";
import { allowedWebOrigins, env } from "@contract-builder/env/server";
import { trpcServer } from "@hono/trpc-server";
import { convertToModelMessages, streamText, wrapLanguageModel } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: allowedWebOrigins,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  })
);

app.post("/ai", async (c) => {
  const body = await c.req.json();
  const uiMessages = body.messages || [];
  const model = wrapLanguageModel({
    model: google("gemini-2.5-flash"),
    middleware: devToolsMiddleware(),
  });
  const result = streamText({
    model,
    messages: await convertToModelMessages(uiMessages),
  });

  return result.toUIMessageStreamResponse();
});

// --- Robokassa callbacks (all configured as POST in the merchant cabinet) ---

// ResultURL: server-to-server webhook. Must verify Password #2 and reply OK{InvId}.
app.post("/result/payment", async (c) => {
  const body = await c.req.parseBody();
  const result = await processRobokassaResult({
    outSum: String(body.OutSum ?? ""),
    invId: String(body.InvId ?? ""),
    signature: String(body.SignatureValue ?? ""),
  });

  if (result.status === "ok") {
    return c.text(`OK${result.invId}`);
  }
  return c.text(result.status, 400);
});

// SuccessURL: browser returns here after a successful payment. Verify Password
// #1 and redirect to the SPA page (authoritative status comes from ResultURL).
app.post("/success/payment", async (c) => {
  const body = await c.req.parseBody();
  const invId = String(body.InvId ?? "");
  const outSum = String(body.OutSum ?? "");
  const signature = String(body.SignatureValue ?? "");

  const valid =
    Boolean(invId) && verifySuccessSignature({ outSum, invId, signature });
  const target = new URL(
    valid ? "/success/payment" : "/fail/payment",
    env.CORS_ORIGIN
  );
  if (invId) {
    target.searchParams.set("invId", invId);
  }
  return c.redirect(target.toString());
});

// FailURL: browser returns here on cancel/decline.
app.post("/fail/payment", async (c) => {
  const body = await c.req.parseBody();
  const invId = String(body.InvId ?? "");
  const target = new URL("/fail/payment", env.CORS_ORIGIN);
  if (invId) {
    target.searchParams.set("invId", invId);
  }
  return c.redirect(target.toString());
});

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
