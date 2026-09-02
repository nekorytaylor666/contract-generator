import { isMailerConfigured } from "@contract-builder/auth/mailer";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publicProcedure, router } from "../index";
import { sendConsultationEmail } from "../lib/mailer";

// Публичная форма на лендинге — эндпоинт доступен без сессии, поэтому
// ограничиваем повторные отправки: не чаще раза в минуту с одного IP
// (и с одной почты — на случай пула IP за прокси).
const SUBMIT_COOLDOWN_MS = 60 * 1000;
const lastSubmitAt = new Map<string, number>();

// Телефон: цифры, +, скобки, пробелы и дефисы; минимум 10 цифр.
const MIN_PHONE_DIGITS = 10;
const PHONE_CHARS_RE = /^[\d\s()+-]+$/;
const NON_DIGIT_RE = /\D/g;

const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .regex(PHONE_CHARS_RE, "Некорректный номер телефона")
  .refine(
    (value) => value.replace(NON_DIGIT_RE, "").length >= MIN_PHONE_DIGITS,
    "Некорректный номер телефона"
  );

const submitInput = z.object({
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email("Некорректная почта").max(254),
  message: z.string().trim().min(5, "Опишите ваш запрос").max(2000),
});

function clientIp(headers: Headers): string {
  // За Cloudflare реальный адрес — в cf-connecting-ip; x-forwarded-for может
  // содержать цепочку прокси, берём первый адрес.
  const cf = headers.get("cf-connecting-ip");
  if (cf) {
    return cf;
  }
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function assertCooldown(key: string): void {
  const now = Date.now();
  const last = lastSubmitAt.get(key);
  if (last !== undefined && now - last < SUBMIT_COOLDOWN_MS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Заявка уже отправлена. Попробуйте снова через минуту.",
    });
  }
  lastSubmitAt.set(key, now);
  // Карта не растёт бесконечно: чистим протухшие записи по ходу.
  for (const [k, ts] of lastSubmitAt) {
    if (now - ts >= SUBMIT_COOLDOWN_MS) {
      lastSubmitAt.delete(k);
    }
  }
}

export const consultationsRouter = router({
  /** Заявка «Получить консультацию» с лендинга: письмо менеджеру. */
  submit: publicProcedure
    .input(submitInput)
    .mutation(async ({ ctx, input }) => {
      if (!isMailerConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Отправка заявок временно недоступна. Напишите нам на info@zhebe.kz",
        });
      }
      assertCooldown(`ip:${clientIp(ctx.headers)}`);
      assertCooldown(`email:${input.email}`);

      await sendConsultationEmail(input);
      return { ok: true } as const;
    }),
});
