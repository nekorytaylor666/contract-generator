// Квоты тарифа (скачивания, редактирования, проверки) месячные: окно идёт от
// даты активации подписки (25.09 → 25.10 → …), без подписки — по календарному
// месяцу. Границы окна считает сервер (subscriptions.mySubscription →
// quotaResetAt); здесь — единая подпись даты сброса для всех экранов, чтобы
// «5 редактирований» нигде не читалось как «5 на весь срок подписки».

import { formatDayMonth } from "@/lib/format-date";

/** «25 октября» / «25 қазан» — дата сброса в формате языка интерфейса.
 * `locative` даёт «25 қазанда» для фраз вида «обновится <дата>». */
export function formatQuotaResetDate(
  language: string,
  resetsAt: Date | string | null | undefined,
  options: { locative?: boolean } = {}
): string {
  if (!resetsAt) {
    return "";
  }
  return formatDayMonth(language, resetsAt, options);
}
