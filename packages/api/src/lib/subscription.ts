import { randomUUID } from "node:crypto";
import { db } from "@contract-builder/db";
import { user } from "@contract-builder/db/schema/auth";
import {
  subscriptionPlan as planTable,
  type subscriptionPlan,
  subscriptionUsage,
} from "@contract-builder/db/schema/subscription";
import { and, eq, sql } from "drizzle-orm";

export type QuotaKind = "download" | "edit" | "review";
type Plan = typeof subscriptionPlan.$inferSelect;

function planQuota(plan: Plan, kind: QuotaKind): number {
  if (kind === "download") {
    return plan.downloadQuota;
  }
  if (kind === "edit") {
    return plan.editQuota;
  }
  return plan.reviewQuota;
}

/** Окно квоты: ключ строки subscription_usage и его границы. */
export interface QuotaPeriod {
  key: string;
  startsAt: Date;
  resetsAt: Date;
}

const MONTHS_IN_YEAR = 12;

/**
 * `date` + `months` месяцев с зажимом числа: якорь 31-го в 30-дневном месяце
 * даёт 30-е, в феврале — 28/29-е. Считается всегда от исходной даты, поэтому
 * дрейфа (31 → 30 → 30 …) нет.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const daysInTarget = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(date.getDate(), daysInTarget));
  return result;
}

/** Календарный месяц как "YYYY-MM" — окно квоты без якоря подписки. */
function calendarPeriod(now: Date): QuotaPeriod {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return {
    key: `${now.getFullYear()}-${month}`,
    startsAt: new Date(now.getFullYear(), now.getMonth(), 1),
    resetsAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Окно квоты для якоря подписки: месячные циклы от даты активации (25.09 →
 * 25.10 → 25.11 …). Ключ — дата начала цикла ("2026-09-25"); он не
 * пересекается с календарным "YYYY-MM", так что смена режима (подписка
 * истекла → дефолтный тариф) просто открывает новую строку использования.
 * Без якоря (или якорь в будущем) — календарный месяц.
 */
export function quotaPeriodFor(
  anchor: Date | null | undefined,
  now: Date = new Date()
): QuotaPeriod {
  if (!anchor || anchor > now) {
    return calendarPeriod(now);
  }
  let cycles =
    (now.getFullYear() - anchor.getFullYear()) * MONTHS_IN_YEAR +
    (now.getMonth() - anchor.getMonth());
  while (cycles > 0 && addMonthsClamped(anchor, cycles) > now) {
    cycles -= 1;
  }
  const startsAt = addMonthsClamped(anchor, cycles);
  return {
    key: isoDate(startsAt),
    startsAt,
    resetsAt: addMonthsClamped(anchor, cycles + 1),
  };
}

/** Current calendar month as "YYYY-MM" — the quota window without an anchor. */
export function currentPeriodKey(): string {
  return calendarPeriod(new Date()).key;
}

/** «25 октября» — дата обновления квоты для сообщений об исчерпанном лимите. */
export function formatResetDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
}

interface SubscriptionState {
  planId: string | null;
  expiresAt: Date | null;
  startedAt: Date | null;
}

async function loadSubscriptionState(
  userId: string
): Promise<SubscriptionState | null> {
  const [row] = await db
    .select({
      planId: user.subscriptionPlanId,
      expiresAt: user.subscriptionExpiresAt,
      startedAt: user.subscriptionStartedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row ?? null;
}

function hasActiveAssignedPlan(state: SubscriptionState | null): boolean {
  return Boolean(
    state?.planId && (!state.expiresAt || state.expiresAt > new Date())
  );
}

/**
 * Якорь месячного периода квот: дата активации действующей подписки. Для
 * истёкшей подписки и дефолтного тарифа — null (календарный месяц).
 */
export function quotaAnchorOf(state: SubscriptionState | null): Date | null {
  return hasActiveAssignedPlan(state) ? (state?.startedAt ?? null) : null;
}

/** Текущее окно квоты пользователя (см. quotaPeriodFor). */
export async function currentQuotaPeriod(userId: string): Promise<QuotaPeriod> {
  const state = await loadSubscriptionState(userId);
  return quotaPeriodFor(quotaAnchorOf(state));
}

/**
 * The plan that applies to a user: their assigned (non-expired) subscription,
 * otherwise the default plan. Null if no default plan exists.
 */
export async function getEffectivePlan(userId: string): Promise<Plan | null> {
  const state = await loadSubscriptionState(userId);

  if (state?.planId && hasActiveAssignedPlan(state)) {
    const [assigned] = await db
      .select()
      .from(planTable)
      .where(eq(planTable.id, state.planId))
      .limit(1);
    if (assigned) {
      return assigned;
    }
  }

  const [fallback] = await db
    .select()
    .from(planTable)
    .where(eq(planTable.isDefault, true))
    .limit(1);
  return fallback ?? null;
}

export async function getUsage(
  userId: string,
  periodKey: string
): Promise<{ downloadsUsed: number; editsUsed: number; reviewsUsed: number }> {
  const [row] = await db
    .select({
      downloadsUsed: subscriptionUsage.downloadsUsed,
      editsUsed: subscriptionUsage.editsUsed,
      reviewsUsed: subscriptionUsage.reviewsUsed,
    })
    .from(subscriptionUsage)
    .where(
      and(
        eq(subscriptionUsage.userId, userId),
        eq(subscriptionUsage.periodKey, periodKey)
      )
    )
    .limit(1);
  return row ?? { downloadsUsed: 0, editsUsed: 0, reviewsUsed: 0 };
}

function usedFor(
  usage: { downloadsUsed: number; editsUsed: number; reviewsUsed: number },
  kind: QuotaKind
): number {
  if (kind === "download") {
    return usage.downloadsUsed;
  }
  if (kind === "edit") {
    return usage.editsUsed;
  }
  return usage.reviewsUsed;
}

/**
 * Try to consume one unit of the user's quota for `kind` in the current
 * period. Increments the usage counter when allowed. `remaining` is -1 for
 * unlimited plans; `resetsAt` — when the quota is granted again.
 */
export async function consumeQuota(
  userId: string,
  kind: QuotaKind
): Promise<{ allowed: boolean; remaining: number; resetsAt: Date }> {
  const plan = await getEffectivePlan(userId);
  const period = await currentQuotaPeriod(userId);
  if (!plan) {
    return { allowed: false, remaining: 0, resetsAt: period.resetsAt };
  }
  const quota = planQuota(plan, kind);
  const usage = await getUsage(userId, period.key);
  const used = usedFor(usage, kind);

  if (quota !== -1 && used >= quota) {
    return { allowed: false, remaining: 0, resetsAt: period.resetsAt };
  }

  const increments = {
    download: { downloadsUsed: sql`${subscriptionUsage.downloadsUsed} + 1` },
    edit: { editsUsed: sql`${subscriptionUsage.editsUsed} + 1` },
    review: { reviewsUsed: sql`${subscriptionUsage.reviewsUsed} + 1` },
  } as const;

  await db
    .insert(subscriptionUsage)
    .values({
      id: randomUUID(),
      userId,
      periodKey: period.key,
      downloadsUsed: kind === "download" ? 1 : 0,
      editsUsed: kind === "edit" ? 1 : 0,
      reviewsUsed: kind === "review" ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: [subscriptionUsage.userId, subscriptionUsage.periodKey],
      set: increments[kind],
    });

  return {
    allowed: true,
    remaining: quota === -1 ? -1 : quota - used - 1,
    resetsAt: period.resetsAt,
  };
}
