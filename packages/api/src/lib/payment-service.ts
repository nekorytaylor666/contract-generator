import { db } from "@contract-builder/db";
import { user } from "@contract-builder/db/schema/auth";
import { payment } from "@contract-builder/db/schema/payment";
import { eq } from "drizzle-orm";

import { formatOutSum, verifyResultSignature } from "./robokassa";

/**
 * Computes when a freshly paid subscription expires: +1 year for "yearly",
 * otherwise +1 month. Returns a new Date, never mutates `from`.
 */
function subscriptionExpiry(from: Date, period: string | null): Date {
  const expiresAt = new Date(from);
  if (period === "yearly") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }
  return expiresAt;
}

type ResultStatus =
  | "ok"
  | "bad_request"
  | "bad_sign"
  | "not_found"
  | "amount_mismatch";

/**
 * Handles a Robokassa ResultURL webhook: verifies the Password #2 signature,
 * checks the amount, and marks the payment paid. Returns a discriminated status
 * the HTTP layer maps to a response (the server replies `OK{InvId}` on "ok").
 */
export async function processRobokassaResult(input: {
  outSum: string;
  invId: string;
  signature: string;
}): Promise<{ status: ResultStatus; invId: number }> {
  const { outSum, invId: invIdRaw, signature } = input;

  if (!(outSum && invIdRaw && signature)) {
    return { status: "bad_request", invId: 0 };
  }
  if (!verifyResultSignature({ outSum, invId: invIdRaw, signature })) {
    return { status: "bad_sign", invId: 0 };
  }

  const invId = Number(invIdRaw);
  const [found] = await db
    .select({
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      userId: payment.userId,
      purpose: payment.purpose,
      subscriptionPlanId: payment.subscriptionPlanId,
      subscriptionPeriod: payment.subscriptionPeriod,
    })
    .from(payment)
    .where(eq(payment.invId, invId))
    .limit(1);

  if (!found) {
    return { status: "not_found", invId };
  }
  // The signature already authenticates OutSum; double-check it matches ours.
  if (Number(outSum) !== Number(formatOutSum(found.amount))) {
    return { status: "amount_mismatch", invId };
  }
  // Only act on the first confirmation — Robokassa may retry the webhook.
  if (found.status === "pending") {
    const paidAt = new Date();
    await db
      .update(payment)
      .set({ status: "paid", paidAt })
      .where(eq(payment.id, found.id));

    // A paid subscription payment activates the plan for the buyer.
    if (found.purpose === "subscription" && found.subscriptionPlanId) {
      await db
        .update(user)
        .set({
          subscriptionPlanId: found.subscriptionPlanId,
          subscriptionPeriod: found.subscriptionPeriod ?? "monthly",
          subscriptionExpiresAt: subscriptionExpiry(
            paidAt,
            found.subscriptionPeriod
          ),
        })
        .where(eq(user.id, found.userId));
    }
  }

  return { status: "ok", invId };
}
