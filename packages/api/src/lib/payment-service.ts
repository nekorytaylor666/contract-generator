import { db } from "@contract-builder/db";
import { payment } from "@contract-builder/db/schema/payment";
import { eq } from "drizzle-orm";

import { formatOutSum, verifyResultSignature } from "./robokassa";

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
    .select({ id: payment.id, amount: payment.amount, status: payment.status })
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
  if (found.status === "pending") {
    await db
      .update(payment)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(payment.id, found.id));
  }

  return { status: "ok", invId };
}
