import { createHash } from "node:crypto";
import { env } from "@contract-builder/env/server";

// Robokassa hosted payment page. The user is redirected here to pay.
const ROBOKASSA_BASE_URL = "https://auth.robokassa.ru/Merchant/Index.aspx";

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

/** Minor units (e.g. cents) → Robokassa OutSum string ("123.45"). Single place
 * to change the money scale/currency handling. */
export function formatOutSum(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

/** Builds the redirect URL to Robokassa's hosted payment page, signed with
 * Password #1. */
export function buildInitPaymentUrl(params: {
  outSum: string;
  invId: number;
  description: string;
}): string {
  const { merchantLogin, password1, isTest } = getRobokassaConfig();
  const signature = md5(
    `${merchantLogin}:${params.outSum}:${params.invId}:${password1}`
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
  return `${ROBOKASSA_BASE_URL}?${query.toString()}`;
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
