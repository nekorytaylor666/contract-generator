import { randomInt, randomUUID } from "node:crypto";
import {
  isMailerConfigured,
  sendAccountDeleteEmail,
  sendContactVerifyEmail,
} from "@contract-builder/auth/mailer";
import { isSmsConfigured, sendSms } from "@contract-builder/auth/sms";
import { db } from "@contract-builder/db";
import {
  account,
  member,
  organization,
  user,
  verification,
} from "@contract-builder/db/schema/auth";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, like, ne } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import { checkCurrentPassword } from "../lib/password-guard";

// Смена email/телефона защищена шаг-апом (текущий пароль, а для аккаунтов без
// пароля — код на текущий телефон) плюс кодом на новый контакт: иначе владелец
// украденной сессии подменил бы контакт на свой и через «Забыли пароль?»
// захватил аккаунт. Код живёт 10 минут, 3 попытки, повторная отправка не чаще
// раза в минуту (in-memory, один инстанс бэкенда).
const CONTACT_CODE_TTL_MS = 10 * 60 * 1000;
const CONTACT_CODE_COOLDOWN_MS = 60 * 1000;
const CONTACT_MAX_ATTEMPTS = 3;
const MILLIS_PER_SECOND = 1000;
const OTP_CEILING = 1_000_000;
const OTP_PAD = 6;
const contactCodeLastSentAt = new Map<string, number>();

const contactChannelSchema = z.enum(["email", "phone"]);
const contactCodeSchema = z.string().regex(/^\d{6}$/);
const emailValueSchema = z.string().trim().toLowerCase().email();
const phoneValueSchema = z.string().trim().min(5).max(20);

type Channel = "email" | "phone";
// "new" — код ушёл на новый контакт (подтверждает владение им);
// "authz" — код ушёл на текущий телефон (только авторизует смену).
type Proof = "new" | "authz";

function contactIdentifier(userId: string, channel: Channel) {
  return `contact-change:${userId}:${channel}`;
}

// Сериализуем проверки кода для одного identifier. Без этого N параллельных
// verifyContactCode прочитали бы одинаковый счётчик attempts и записали N+1,
// перебрав 6-значный код в обход CONTACT_MAX_ATTEMPTS (критично для authz-пути,
// где код уходит на телефон жертвы). Бэкенд — один инстанс, очередь в памяти
// процесса закрывает гонку.
const contactVerifyChains = new Map<string, Promise<unknown>>();

function runSerialized<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prev = contactVerifyChains.get(key) ?? Promise.resolve();
  const result = prev.then(task, task);
  // В карте держим «проглоченную» версию: следующий в очереди стартует после
  // завершения текущего, а необработанные reject не всплывают.
  const settled = result.then(
    () => undefined,
    () => undefined
  );
  contactVerifyChains.set(key, settled);
  settled.then(() => {
    if (contactVerifyChains.get(key) === settled) {
      contactVerifyChains.delete(key);
    }
  });
  return result;
}

function cooldownSeconds(sinceMs: number): number {
  return Math.ceil((CONTACT_CODE_COOLDOWN_MS - sinceMs) / MILLIS_PER_SECOND);
}

function generateCode(): string {
  return randomInt(0, OTP_CEILING).toString().padStart(OTP_PAD, "0");
}

// Postgres unique_violation (email/phone заняты параллельно).
const PG_UNIQUE_VIOLATION = "23505";
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

async function contactTakenByOther(
  channel: Channel,
  value: string,
  userId: string
): Promise<boolean> {
  const column = channel === "email" ? user.email : user.phoneNumber;
  const [taken] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(column, value), ne(user.id, userId)))
    .limit(1);
  return Boolean(taken);
}

async function deliverCode(
  via: "email" | "sms",
  to: string,
  code: string
): Promise<void> {
  if (via === "email") {
    if (isMailerConfigured()) {
      await sendContactVerifyEmail(to, code);
    } else {
      process.stderr.write(`[Contact verify stub] ${to}: код ${code}\n`);
    }
    return;
  }
  if (isSmsConfigured()) {
    await sendSms(to, `Zhebe: код подтверждения ${code}`);
  } else {
    process.stderr.write(`[Contact verify stub] ${to}: код ${code}\n`);
  }
}

// Удаление аккаунта подтверждается кодом на текущую почту (или телефон, если
// почты нет) — тот же режим, что у смены контакта: 10 минут, 3 попытки,
// повторная отправка не чаще раза в минуту.
function deleteAccountIdentifier(userId: string) {
  return `delete-account:${userId}`;
}

async function deliverDeleteCode(
  via: "email" | "sms",
  to: string,
  code: string
): Promise<void> {
  if (via === "email") {
    if (isMailerConfigured()) {
      await sendAccountDeleteEmail(to, code);
    } else {
      process.stderr.write(`[Delete account stub] ${to}: код ${code}\n`);
    }
    return;
  }
  if (isSmsConfigured()) {
    await sendSms(to, `Zhebe: код для удаления аккаунта ${code}`);
  } else {
    process.stderr.write(`[Delete account stub] ${to}: код ${code}\n`);
  }
}

type StepUp =
  | {
      ok: true;
      proof: Proof;
      deliverVia: "email" | "sms";
      deliverTo: string;
    }
  | { ok: false; response: StepUpError };

type StepUpError =
  | { status: "password_required" }
  | { status: "invalid_password"; attemptsLeft: number }
  | { status: "locked"; retryAfterSeconds: number }
  | { status: "no_step_up" };

// Проверяет право сменить контакт фактором, которого нет у угонщика сессии:
// текущий пароль (если он есть) либо код на текущий телефон (для аккаунтов без
// пароля). Возвращает, куда и как отправить код подтверждения.
async function resolveStepUp(
  userId: string,
  channel: Channel,
  value: string,
  currentPassword: string | undefined
): Promise<StepUp> {
  const [credential] = await db
    .select({ password: account.password })
    .from(account)
    .where(
      and(eq(account.userId, userId), eq(account.providerId, "credential"))
    )
    .limit(1);

  if (credential?.password) {
    if (!currentPassword) {
      return { ok: false, response: { status: "password_required" } };
    }
    const check = await checkCurrentPassword(userId, currentPassword);
    if (check.status === "locked") {
      return {
        ok: false,
        response: {
          status: "locked",
          retryAfterSeconds: check.retryAfterSeconds,
        },
      };
    }
    if (check.status !== "ok") {
      return {
        ok: false,
        response: {
          status: "invalid_password",
          attemptsLeft:
            check.status === "invalid"
              ? check.attemptsLeft
              : CONTACT_MAX_ATTEMPTS,
        },
      };
    }
    return {
      ok: true,
      proof: "new",
      deliverVia: channel === "email" ? "email" : "sms",
      deliverTo: value,
    };
  }

  const [profile] = await db
    .select({ phoneNumber: user.phoneNumber })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!profile?.phoneNumber) {
    return { ok: false, response: { status: "no_step_up" } };
  }
  return {
    ok: true,
    proof: "authz",
    deliverVia: "sms",
    deliverTo: profile.phoneNumber,
  };
}

export const accountRouter = router({
  // The current user's editable profile fields.
  me: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        image: user.image,
        contractLanguage: user.contractLanguage,
        twoFactorEnabled: user.twoFactorEnabled,
      })
      .from(user)
      .where(eq(user.id, ctx.session.user.id))
      .limit(1);
    return row ?? null;
  }),

  // Меняет только неконфиденциальные поля. Email/телефон здесь можно лишь
  // ОЧИСТИТЬ (null) — установка нового значения идёт через verifyContactCode.
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120).optional(),
        email: z.null().optional(),
        phoneNumber: z.null().optional(),
        contractLanguage: z.enum(["ru", "kk", "en"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const updates: Partial<typeof user.$inferInsert> = {};
      if (input.name !== undefined) {
        updates.name = input.name;
      }
      if (input.email === null) {
        // Коды 2FA приходят на почту: удалить её при включённой 2FA — значит
        // потерять доступ к аккаунту.
        const [row] = await db
          .select({ twoFactorEnabled: user.twoFactorEnabled })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);
        if (row?.twoFactorEnabled) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Сначала отключите двухфакторную аутентификацию — коды входа приходят на эту почту.",
          });
        }
        updates.email = null;
        updates.emailVerified = false;
      }
      if (input.phoneNumber === null) {
        updates.phoneNumber = null;
        updates.phoneNumberVerified = false;
      }
      if (input.contractLanguage !== undefined) {
        updates.contractLanguage = input.contractLanguage;
      }

      if (Object.keys(updates).length > 0) {
        await db.update(user).set(updates).where(eq(user.id, userId));
      }
      return { success: true };
    }),

  // Шаг 1 смены контакта: шаг-ап (пароль/код на текущий телефон) + отправка
  // кода. Куда ушёл код — в поле sentTo (новый контакт либо текущий телефон).
  requestContactChangeCode: protectedProcedure
    .input(
      z.object({
        channel: contactChannelSchema,
        value: z.string().trim().min(1),
        currentPassword: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const parsed =
        input.channel === "email"
          ? emailValueSchema.safeParse(input.value)
          : phoneValueSchema.safeParse(input.value);
      if (!parsed.success) {
        return { status: "invalid_value" as const };
      }
      const value = parsed.data;

      const stepUp = await resolveStepUp(
        userId,
        input.channel,
        value,
        input.currentPassword
      );
      if (!stepUp.ok) {
        return stepUp.response;
      }
      const { proof, deliverVia, deliverTo } = stepUp;

      if (await contactTakenByOther(input.channel, value, userId)) {
        return { status: "taken" as const };
      }

      const cooldownKey = `${userId}:${input.channel}`;
      const identifier = contactIdentifier(userId, input.channel);
      const now = Date.now();
      // Протухшие записи уже не блокируют — чистим, чтобы карта не росла без
      // предела за время жизни процесса.
      for (const [key, at] of contactCodeLastSentAt) {
        if (now - at >= CONTACT_CODE_COOLDOWN_MS) {
          contactCodeLastSentAt.delete(key);
        }
      }
      const lastSentAt = contactCodeLastSentAt.get(cooldownKey);
      if (lastSentAt && now - lastSentAt < CONTACT_CODE_COOLDOWN_MS) {
        // Новый код не отправляем; сообщаем, куда ушёл прежний. Значение
        // могло измениться между запросами — живой код привязан к цели из
        // заявки, а не к только что введённому значению.
        const [pendingRow] = await db
          .select({ value: verification.value })
          .from(verification)
          .where(eq(verification.identifier, identifier))
          .limit(1);
        // Нет активной заявки (прежний код использован/сгорел) → sentTo=null:
        // клиент не поведёт на шаг ввода несуществующего кода. Иначе "new" —
        // код на сам новый контакт, "authz" — на текущий телефон (deliverTo).
        let sentTo: string | null = null;
        if (pendingRow) {
          const parts = pendingRow.value.split(":");
          sentTo = parts[2] === "new" ? parts.slice(3).join(":") : deliverTo;
        }
        return {
          status: "cooldown" as const,
          retryAfterSeconds: cooldownSeconds(now - lastSentAt),
          sentTo,
        };
      }

      const code = generateCode();
      // Одна активная заявка на канал. value = code:attempts:proof:target.
      await db
        .delete(verification)
        .where(eq(verification.identifier, identifier));
      await db.insert(verification).values({
        id: randomUUID(),
        identifier,
        value: `${code}:0:${proof}:${value}`,
        expiresAt: new Date(now + CONTACT_CODE_TTL_MS),
      });
      contactCodeLastSentAt.set(cooldownKey, now);

      try {
        await deliverCode(deliverVia, deliverTo, code);
      } catch (err) {
        contactCodeLastSentAt.delete(cooldownKey);
        await db
          .delete(verification)
          .where(eq(verification.identifier, identifier));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            err instanceof Error ? err.message : "Не удалось отправить код",
        });
      }
      return {
        status: "sent" as const,
        retryAfterSeconds: Math.ceil(
          CONTACT_CODE_COOLDOWN_MS / MILLIS_PER_SECOND
        ),
        sentTo: deliverTo,
      };
    }),

  // Шаг 2 смены контакта: проверить код и сохранить контакт. Через очередь
  // на identifier, чтобы параллельные попытки не обходили лимит кода.
  verifyContactCode: protectedProcedure
    .input(
      z.object({
        channel: contactChannelSchema,
        code: contactCodeSchema,
      })
    )
    .mutation(({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const identifier = contactIdentifier(userId, input.channel);
      return runSerialized(identifier, () =>
        processContactVerification(
          userId,
          input.channel,
          input.code,
          identifier
        )
      );
    }),

  // Шаг 1 удаления аккаунта: отправить код на текущую почту (или телефон,
  // если почты нет). Намерение пользователь уже подтвердил на клиенте,
  // введя свою почту, — код доказывает владение контактом.
  requestDeleteCode: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [profile] = await db
      .select({ email: user.email, phoneNumber: user.phoneNumber })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const deliverVia = profile?.email ? ("email" as const) : ("sms" as const);
    const deliverTo = profile?.email ?? profile?.phoneNumber;
    if (!deliverTo) {
      return { status: "no_contact" as const };
    }

    const cooldownKey = `${userId}:delete-account`;
    const identifier = deleteAccountIdentifier(userId);
    const now = Date.now();
    const lastSentAt = contactCodeLastSentAt.get(cooldownKey);
    if (lastSentAt && now - lastSentAt < CONTACT_CODE_COOLDOWN_MS) {
      // Прежний код мог быть использован/сгореть — тогда sentTo=null и клиент
      // не поведёт на шаг ввода несуществующего кода.
      const [pendingRow] = await db
        .select({ id: verification.id })
        .from(verification)
        .where(eq(verification.identifier, identifier))
        .limit(1);
      return {
        status: "cooldown" as const,
        retryAfterSeconds: cooldownSeconds(now - lastSentAt),
        sentTo: pendingRow ? deliverTo : null,
      };
    }

    const code = generateCode();
    // Одна активная заявка. value = code:attempts.
    await db
      .delete(verification)
      .where(eq(verification.identifier, identifier));
    await db.insert(verification).values({
      id: randomUUID(),
      identifier,
      value: `${code}:0`,
      expiresAt: new Date(now + CONTACT_CODE_TTL_MS),
    });
    contactCodeLastSentAt.set(cooldownKey, now);

    try {
      await deliverDeleteCode(deliverVia, deliverTo, code);
    } catch (err) {
      contactCodeLastSentAt.delete(cooldownKey);
      await db
        .delete(verification)
        .where(eq(verification.identifier, identifier));
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          err instanceof Error ? err.message : "Не удалось отправить код",
      });
    }
    return {
      status: "sent" as const,
      retryAfterSeconds: Math.ceil(
        CONTACT_CODE_COOLDOWN_MS / MILLIS_PER_SECOND
      ),
      sentTo: deliverTo,
    };
  }),

  // Шаг 2 удаления аккаунта: проверить код и удалить пользователя со всеми
  // данными. Очередь на identifier — та же защита от параллельного перебора.
  confirmDeleteAccount: protectedProcedure
    .input(z.object({ code: contactCodeSchema }))
    .mutation(({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const identifier = deleteAccountIdentifier(userId);
      return runSerialized(identifier, () =>
        processAccountDeletion(userId, input.code, identifier)
      );
    }),
});

type VerifyResult =
  | { status: "invalid_code" }
  | { status: "code_expired" }
  | { status: "too_many_attempts" }
  | { status: "taken" }
  | { status: "ok"; value: string };

async function processContactVerification(
  userId: string,
  channel: Channel,
  code: string,
  identifier: string
): Promise<VerifyResult> {
  const [row] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1);
  if (!row) {
    return { status: "invalid_code" };
  }
  if (row.expiresAt < new Date()) {
    await db.delete(verification).where(eq(verification.id, row.id));
    return { status: "code_expired" };
  }

  const [storedCode, attemptsRaw, proof, ...valueParts] = row.value.split(":");
  const target = valueParts.join(":");
  const attempts = Number.parseInt(attemptsRaw ?? "0", 10) || 0;
  if (attempts >= CONTACT_MAX_ATTEMPTS) {
    await db.delete(verification).where(eq(verification.id, row.id));
    return { status: "too_many_attempts" };
  }
  if (code !== storedCode) {
    await db
      .update(verification)
      .set({ value: `${storedCode}:${attempts + 1}:${proof}:${target}` })
      .where(eq(verification.id, row.id));
    return { status: "invalid_code" };
  }

  if (await contactTakenByOther(channel, target, userId)) {
    await db.delete(verification).where(eq(verification.id, row.id));
    return { status: "taken" };
  }

  // verified = true только когда код доказал владение самим новым контактом
  // (proof "new"); при авторизации через текущий телефон — false.
  const verified = proof === "new";
  try {
    await db
      .update(user)
      .set(
        channel === "email"
          ? { email: target, emailVerified: verified }
          : { phoneNumber: target, phoneNumberVerified: verified }
      )
      .where(eq(user.id, userId));
  } catch (err) {
    // Гонка с TOCTOU-проверкой выше: контакт заняли между проверкой и записью.
    // email/phone уникальны в схеме — отдаём «занято», а не 500.
    if (isUniqueViolation(err)) {
      await db.delete(verification).where(eq(verification.id, row.id));
      return { status: "taken" };
    }
    throw err;
  }
  await db.delete(verification).where(eq(verification.id, row.id));
  return { status: "ok", value: target };
}

type DeleteAccountResult =
  | { status: "invalid_code" }
  | { status: "code_expired" }
  | { status: "too_many_attempts" }
  | { status: "ok" };

async function processAccountDeletion(
  userId: string,
  code: string,
  identifier: string
): Promise<DeleteAccountResult> {
  const [row] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1);
  if (!row) {
    return { status: "invalid_code" };
  }
  if (row.expiresAt < new Date()) {
    await db.delete(verification).where(eq(verification.id, row.id));
    return { status: "code_expired" };
  }

  const [storedCode, attemptsRaw] = row.value.split(":");
  const attempts = Number.parseInt(attemptsRaw ?? "0", 10) || 0;
  if (attempts >= CONTACT_MAX_ATTEMPTS) {
    await db.delete(verification).where(eq(verification.id, row.id));
    return { status: "too_many_attempts" };
  }
  if (code !== storedCode) {
    await db
      .update(verification)
      .set({ value: `${storedCode}:${attempts + 1}` })
      .where(eq(verification.id, row.id));
    return { status: "invalid_code" };
  }

  await db.transaction(async (tx) => {
    // Организации, где пользователь был единственным участником, удаляем
    // целиком — каскадом уйдут их реквизиты, договоры и приглашения. Команды
    // с другими участниками не трогаем: членство удалится каскадом от user.
    const memberships = await tx
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId));
    const orgIds = memberships.map((m) => m.organizationId);
    if (orgIds.length > 0) {
      const others = await tx
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(
          and(inArray(member.organizationId, orgIds), ne(member.userId, userId))
        );
      const shared = new Set(others.map((m) => m.organizationId));
      const soloOrgIds = orgIds.filter((id) => !shared.has(id));
      if (soloOrgIds.length > 0) {
        await tx
          .delete(organization)
          .where(inArray(organization.id, soloOrgIds));
      }
    }
    // Висящие коды пользователя (смена контакта, 2FA, удаление) — их
    // идентификаторы содержат userId.
    await tx
      .delete(verification)
      .where(like(verification.identifier, `%${userId}%`));
    // Остальное каскадом от user: сессии, аккаунты, договоры, платежи,
    // закладки, использование подписки, секрет 2FA.
    await tx.delete(user).where(eq(user.id, userId));
  });
  return { status: "ok" };
}
