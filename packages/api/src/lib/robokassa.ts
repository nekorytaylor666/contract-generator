import { createHash } from "node:crypto";
import { env } from "@contract-builder/env/server";

// Robokassa hosted payment page. The user is redirected here to pay.
const ROBOKASSA_BASE_URL = "https://auth.robokassa.ru/Merchant/Index.aspx";
const TRAILING_SLASH_REGEX = /\/$/;

function md5(value: string): string {
  return createHash("md5").update(value, "utf8").digest("hex");
}

interface RobokassaConfig {
  merchantLogin: string;
  password1: string;
  password2: string;
  isTest: boolean;
}

/** Reads + validates Robokassa env config. Throws if a checkout is attempted
 * while the gateway isn't configured. */
export function getRobokassaConfig(): RobokassaConfig {
  const merchantLogin = env.ROBOKASSA_MERCHANT_LOGIN;
  const password1 = env.ROBOKASSA_PASSWORD_1;
  const password2 = env.ROBOKASSA_PASSWORD_2;
  if (!(merchantLogin && password1 && password2)) {
    throw new Error(
      "Robokassa не настроена: задайте ROBOKASSA_MERCHANT_LOGIN / ROBOKASSA_PASSWORD_1 / ROBOKASSA_PASSWORD_2"
    );
  }
  return { merchantLogin, password1, password2, isTest: env.ROBOKASSA_IS_TEST };
}

/** Whole tenge (major units) → Robokassa OutSum string ("23870.00"). Amounts
 * are stored as whole numbers in the major currency unit, so this only formats
 * to 2 decimals — it never rescales. Single place to change money handling. */
export function formatOutSum(amount: number): string {
  return amount.toFixed(2);
}

/** Builds the redirect URL to Robokassa's hosted payment page, signed with
 * Password #1. */
export function buildInitPaymentUrl(params: {
  outSum: string;
  invId: number;
  description: string;
}): string {
  const { merchantLogin, password1, isTest } = getRobokassaConfig();

  // Optionally return the browser to our own server handlers (SuccessUrl2 /
  // FailUrl2) instead of the cabinet-configured URLs. When enabled, these are
  // part of the signature and must be URL-encoded with uppercase methods.
  // Robokassa POSTs to them; /success/payment and /fail/payment verify the
  // redirect signature and forward to the SPA.
  let dynamicUrls: { successEnc: string; failEnc: string } | null = null;
  if (env.ROBOKASSA_DYNAMIC_URLS) {
    const base = env.BETTER_AUTH_URL.replace(TRAILING_SLASH_REGEX, "");
    dynamicUrls = {
      successEnc: encodeURIComponent(`${base}/success/payment`),
      failEnc: encodeURIComponent(`${base}/fail/payment`),
    };
  }

  const signatureBase = `${merchantLogin}:${params.outSum}:${params.invId}`;
  const signature = md5(
    dynamicUrls
      ? `${signatureBase}:${dynamicUrls.successEnc}:POST:${dynamicUrls.failEnc}:POST:${password1}`
      : `${signatureBase}:${password1}`
  );

  const query = new URLSearchParams({
    MerchantLogin: merchantLogin,
    OutSum: params.outSum,
    InvId: String(params.invId),
    Description: params.description,
    SignatureValue: signature,
    Culture: "ru",
    Encoding: "utf-8",
  });
  if (isTest) {
    query.set("IsTest", "1");
  }

  let url = `${ROBOKASSA_BASE_URL}?${query.toString()}`;
  if (dynamicUrls) {
    // Append manually so the encoding exactly matches what we signed
    // (URLSearchParams would re-encode the already-encoded values).
    url += `&SuccessUrl2=${dynamicUrls.successEnc}&SuccessUrl2Method=POST&FailUrl2=${dynamicUrls.failEnc}&FailUrl2Method=POST`;
  }
  return url;
}

function signaturesMatch(expected: string, received: string): boolean {
  return expected.toLowerCase() === received.trim().toLowerCase();
}

/** Verifies the ResultURL webhook signature (Password #2). `outSum`/`invId` are
 * the raw strings as received from Robokassa. */
export function verifyResultSignature(params: {
  outSum: string;
  invId: string;
  signature: string;
}): boolean {
  const { password2 } = getRobokassaConfig();
  const expected = md5(`${params.outSum}:${params.invId}:${password2}`);
  return signaturesMatch(expected, params.signature);
}

/** Verifies the SuccessURL redirect signature (Password #1). */
export function verifySuccessSignature(params: {
  outSum: string;
  invId: string;
  signature: string;
}): boolean {
  const { password1 } = getRobokassaConfig();
  const expected = md5(`${params.outSum}:${params.invId}:${password1}`);
  return signaturesMatch(expected, params.signature);
}
