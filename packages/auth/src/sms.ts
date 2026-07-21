import { env } from "@contract-builder/env/server";

const REQUEST_TIMEOUT_MS = 10_000;
const NON_DIGITS_REGEX = /\D/g;

interface MobizonResponse {
  code: number;
  message?: string;
  data?: unknown;
}

/** True when the Mobizon SMS gateway is configured. */
export function isSmsConfigured(): boolean {
  return Boolean(env.MOBIZON_API_KEY);
}

/**
 * Sends one SMS via Mobizon (api.mobizon.kz). Recipient may be in any format —
 * it's normalized to bare international digits (e.g. «+7 707 …» → 7707…).
 * Throws with the gateway's error message on failure.
 */
export async function sendSms(recipient: string, text: string): Promise<void> {
  if (!env.MOBIZON_API_KEY) {
    throw new Error("SMS не настроены: задайте MOBIZON_API_KEY");
  }

  const url = new URL("/service/Message/SendSmsMessage", env.MOBIZON_API_URL);
  url.searchParams.set("output", "json");
  url.searchParams.set("api", "v1");
  url.searchParams.set("apiKey", env.MOBIZON_API_KEY);

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      recipient: recipient.replace(NON_DIGITS_REGEX, ""),
      text,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Mobizon: HTTP ${response.status}`);
  }
  const result = (await response.json()) as MobizonResponse;
  // Mobizon: code 0 = accepted; anything else is an error (invalid key,
  // bad recipient, insufficient balance, …).
  if (result.code !== 0) {
    throw new Error(
      `Mobizon: ошибка ${result.code}${result.message ? ` — ${result.message}` : ""}`
    );
  }
}
