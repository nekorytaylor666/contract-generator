import { db } from "@contract-builder/db";
import { member, user } from "@contract-builder/db/schema/auth";
import { payment } from "@contract-builder/db/schema/payment";
import { template } from "@contract-builder/db/schema/template";
import { and, eq, inArray } from "drizzle-orm";

import { canEditDocuments } from "../constants/access";
import { createDocumentFromTemplate, type DbClient } from "./document-service";
import { formatOutSum, verifyResultSignature } from "./robokassa";

/**
 * Computes when a freshly paid subscription expires: +1 year for "yearly",
 * otherwise +1 month. Returns a new Date, never mutates `from`.
 */
function subscriptionExpiry(from: Date, period: string | null): Date {
  const expiresAt = new Date(from);
  if (period === "yearly") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else if (period === "quarterly") {
    expiresAt.setMonth(expiresAt.getMonth() + 3);
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
 * Создаёт черновик в «Моих документах» для оплаченной прямой покупки
 * редактирования. Вебхук — единственное гарантированное место: покупатель
 * может закрыть браузер и никогда не открыть success-страницу.
 *
 * Работает внутри транзакции вебхука через вложенный savepoint: ошибка
 * создания откатывает только черновик, а не пометку «оплачено» (клиентский
 * путь documents.save с обходом квоты остаётся запасным). Возвращает null,
 * когда черновик создать нельзя.
 */
async function createPurchasedDraft(
  tx: DbClient,
  paid: {
    userId: string;
    organizationId: string | null;
    templateId: string;
  }
): Promise<string | null> {
  try {
    return await tx.transaction(async (inner) => {
      // Членство проверяем на момент вебхука, а не чекаута: организацию из
      // платежа используем, только если покупатель всё ещё её участник с
      // правом редактирования — иначе документ уехал бы в чужой тенант.
      // Логика повторяет orgProcedure + editorProcedure.
      const memberships = await inner
        .select({
          organizationId: member.organizationId,
          role: member.role,
        })
        .from(member)
        .where(eq(member.userId, paid.userId));
      const editable = memberships.filter((m) => canEditDocuments(m.role));
      const membership =
        editable.find((m) => m.organizationId === paid.organizationId) ??
        editable[0];
      if (!membership) {
        return null;
      }

      const [tmpl] = await inner
        .select()
        .from(template)
        .where(eq(template.id, paid.templateId))
        .limit(1);
      if (!tmpl) {
        return null;
      }

      // Заголовок — на языке договоров из профиля покупателя, как в билдере.
      const [buyer] = await inner
        .select({ contractLanguage: user.contractLanguage })
        .from(user)
        .where(eq(user.id, paid.userId))
        .limit(1);

      const created = await createDocumentFromTemplate(inner, {
        tmpl,
        orgId: membership.organizationId,
        userId: paid.userId,
        locale: buyer?.contractLanguage ?? undefined,
        variables: {},
      });
      return created.id;
    });
  } catch (error) {
    console.error(
      "Не удалось создать документ после оплаты шаблона:",
      paid.templateId,
      error
    );
    return null;
  }
}

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
      organizationId: payment.organizationId,
      templateId: payment.templateId,
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
  // "expired" is honored too: a 6h-timed-out invoice that is genuinely paid
  // (late confirmation) should still complete so no real payment is lost.
  if (found.status === "pending" || found.status === "expired") {
    const paidAt = new Date();

    await db.transaction(async (tx) => {
      // Условный claim сериализует конкурентные/повторные доставки вебхука:
      // проигравшая доставка обновит 0 строк и не создаст второй черновик.
      const claimed = await tx
        .update(payment)
        .set({ status: "paid", paidAt })
        .where(
          and(
            eq(payment.id, found.id),
            inArray(payment.status, ["pending", "expired"])
          )
        )
        .returning({ id: payment.id });
      if (claimed.length === 0) {
        return;
      }

      // Купленное редактирование шаблона сразу материализуется черновиком в
      // «Моих документах». documentId коммитится вместе со статусом, чтобы
      // success-страница, увидев paid, гарантированно увидела и documentId
      // (она перестаёт опрашивать сервер после первого paid-ответа).
      const isEditPurchase =
        found.purpose === "template_edit" ||
        found.purpose === "template_purchase";
      if (isEditPurchase && found.templateId) {
        const documentId = await createPurchasedDraft(tx, {
          userId: found.userId,
          organizationId: found.organizationId,
          templateId: found.templateId,
        });
        if (documentId) {
          await tx
            .update(payment)
            .set({ documentId })
            .where(eq(payment.id, found.id));
        }
      }

      // A paid subscription payment activates the plan for the buyer.
      if (found.purpose === "subscription" && found.subscriptionPlanId) {
        await tx
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
    });
  }

  return { status: "ok", invId };
}
