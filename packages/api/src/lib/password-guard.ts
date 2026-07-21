import { auth } from "@contract-builder/auth";
import { db } from "@contract-builder/db";
import { account } from "@contract-builder/db/schema/auth";
import { and, eq } from "drizzle-orm";

// Лимит попыток ввода текущего пароля: после третьей неверной — блокировка на
// 10 минут. Счётчик в памяти процесса (бэкенд — один инстанс). Общий для смены
// пароля (verifyPassword/changePassword) и шаг-апа при смене контакта.
const MAX_PASSWORD_ATTEMPTS = 3;
const PASSWORD_LOCKOUT_MS = 10 * 60 * 1000;
const MILLIS_PER_SECOND = 1000;
const passwordAttempts = new Map<
  string,
  { count: number; lockedUntil: number | null }
>();

export type CurrentPasswordCheck =
  | { status: "ok"; hash: string }
  | { status: "no_password" }
  | { status: "invalid"; attemptsLeft: number }
  | { status: "locked"; retryAfterSeconds: number };

// Синхронно (до первого await) резервирует попытку — параллельная пачка
// запросов не может проскочить мимо лимита между проверкой и инкрементом.
function reserveAttempt(
  userId: string
): { attempt: number } | { status: "locked"; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = passwordAttempts.get(userId);
  if (entry?.lockedUntil) {
    if (entry.lockedUntil > now) {
      return {
        status: "locked",
        retryAfterSeconds: Math.ceil(
          (entry.lockedUntil - now) / MILLIS_PER_SECOND
        ),
      };
    }
    passwordAttempts.delete(userId);
  }

  const attempt = (passwordAttempts.get(userId)?.count ?? 0) + 1;
  if (attempt > MAX_PASSWORD_ATTEMPTS) {
    passwordAttempts.set(userId, {
      count: attempt,
      lockedUntil: now + PASSWORD_LOCKOUT_MS,
    });
    return {
      status: "locked",
      retryAfterSeconds: Math.ceil(PASSWORD_LOCKOUT_MS / MILLIS_PER_SECOND),
    };
  }
  passwordAttempts.set(userId, { count: attempt, lockedUntil: null });
  return { attempt };
}

function releaseAttempt(userId: string) {
  const entry = passwordAttempts.get(userId);
  if (entry && !entry.lockedUntil && entry.count > 0) {
    entry.count -= 1;
  }
}

/** Сбрасывает счётчик неудачных попыток (после успешной смены пароля). */
export function clearPasswordAttempts(userId: string) {
  passwordAttempts.delete(userId);
}

export async function checkCurrentPassword(
  userId: string,
  password: string
): Promise<CurrentPasswordCheck> {
  const reserved = reserveAttempt(userId);
  if ("status" in reserved) {
    return reserved;
  }

  const [credential] = await db
    .select({ password: account.password })
    .from(account)
    .where(
      and(eq(account.userId, userId), eq(account.providerId, "credential"))
    )
    .limit(1);
  if (!credential?.password) {
    // Попытка не считается: пароля нет, перебирать нечего.
    releaseAttempt(userId);
    return { status: "no_password" };
  }

  // Проверяем тем же хешером, который сконфигурирован в better-auth.
  const authContext = await auth.$context;
  const valid = await authContext.password.verify({
    hash: credential.password,
    password,
  });
  if (!valid) {
    if (reserved.attempt >= MAX_PASSWORD_ATTEMPTS) {
      passwordAttempts.set(userId, {
        count: reserved.attempt,
        lockedUntil: Date.now() + PASSWORD_LOCKOUT_MS,
      });
      return {
        status: "locked",
        retryAfterSeconds: Math.ceil(PASSWORD_LOCKOUT_MS / MILLIS_PER_SECOND),
      };
    }
    return {
      status: "invalid",
      attemptsLeft: MAX_PASSWORD_ATTEMPTS - reserved.attempt,
    };
  }

  passwordAttempts.delete(userId);
  return { status: "ok", hash: credential.password };
}
