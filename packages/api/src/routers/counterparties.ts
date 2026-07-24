import { randomUUID } from "node:crypto";
import { db } from "@contract-builder/db";
import { counterparty } from "@contract-builder/db/schema/counterparty";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { editorProcedure, orgProcedure, router } from "../index";
import { getEffectivePlan } from "../lib/subscription";

// По макету фича доступна на любой подписке, кроме разового тарифа. Кнопка
// скрыта на клиенте, но серверная проверка обязательна.
async function ensurePaidPlan(userId: string): Promise<void> {
  const plan = await getEffectivePlan(userId);
  if (!plan || plan.isDefault) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Контрагенты доступны на любой подписке, кроме разовой",
    });
  }
}

const BIN_RE = /^\d{12}$/;
const IBAN_RE = /^KZ[A-Z0-9]{18}$/;
const BIK_RE = /^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$/;
const KBE_RE = /^\d{2}$/;
const KNP_RE = /^\d{3}$/;

// Правила совпадают с валидацией мастера «Добавить контрагента» в вебе.
const counterpartyFields = {
  name: z
    .string()
    .trim()
    .min(1, "Введите полное наименование организации")
    .max(200),
  type: z.enum(["ТОО", "ИП", "АО"], {
    message: "Выберите тип организации",
  }),
  bin: z.string().trim().regex(BIN_RE, "БИН должен содержать ровно 12 цифр"),
  address: z
    .string()
    .trim()
    .min(1, "Введите юридический адрес организации")
    .max(500),
  phone: z.string().trim().min(1, "Введите номер телефона").max(60),
  email: z
    .string()
    .trim()
    .email("Введите корректный адрес электронной почты")
    .max(160),
  bank: z.string().trim().min(1, "Введите полное наименование банка").max(200),
  iban: z
    .string()
    .trim()
    .toUpperCase()
    .regex(IBAN_RE, "IBAN должен начинаться с KZ и содержать 20 символов"),
  bik: z
    .string()
    .trim()
    .toUpperCase()
    .regex(BIK_RE, "БИК должен содержать 8 или 11 символов"),
  kbe: z.string().trim().regex(KBE_RE, "КБе должен содержать 2 цифры"),
  knp: z.string().trim().regex(KNP_RE, "КНП должен содержать 3 цифры"),
  signatory: z
    .string()
    .trim()
    .min(1, "Введите полное ФИО — фамилию, имя и отчество")
    .max(200),
  position: z.string().trim().min(1, "Введите должность подписанта").max(200),
  basis: z
    .string()
    .trim()
    .min(1, "Укажите основание — Устав или номер доверенности")
    .max(200),
};

export const counterpartiesRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    await ensurePaidPlan(ctx.session.user.id);
    return await db
      .select()
      .from(counterparty)
      .where(eq(counterparty.organizationId, ctx.orgId))
      .orderBy(asc(counterparty.createdAt));
  }),

  create: editorProcedure
    .input(z.object(counterpartyFields))
    .mutation(async ({ ctx, input }) => {
      await ensurePaidPlan(ctx.session.user.id);
      const id = randomUUID();
      await db
        .insert(counterparty)
        .values({ id, organizationId: ctx.orgId, ...input });
      return { id };
    }),

  update: editorProcedure
    .input(z.object({ id: z.string(), ...counterpartyFields }))
    .mutation(async ({ ctx, input }) => {
      await ensurePaidPlan(ctx.session.user.id);
      const { id, ...fields } = input;
      const updated = await db
        .update(counterparty)
        .set(fields)
        .where(
          and(
            eq(counterparty.id, id),
            eq(counterparty.organizationId, ctx.orgId)
          )
        )
        .returning({ id: counterparty.id });
      if (updated.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Контрагент не найден",
        });
      }
      return { id };
    }),

  // Принимает список id — из таблицы можно удалять и по одному, и пачкой
  // через чекбоксы.
  delete: editorProcedure
    .input(z.object({ ids: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ensurePaidPlan(ctx.session.user.id);
      await db
        .delete(counterparty)
        .where(
          and(
            inArray(counterparty.id, input.ids),
            eq(counterparty.organizationId, ctx.orgId)
          )
        );
      return { success: true };
    }),
});
