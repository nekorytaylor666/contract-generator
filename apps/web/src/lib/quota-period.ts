// Квоты тарифа (скачивания, редактирования, проверки) месячные: окно идёт от
// даты активации подписки (25.09 → 25.10 → …), без подписки — по календарному
// месяцу. Границы окна считает сервер (subscriptions.mySubscription →
// quotaResetAt); здесь — единая подпись даты сброса для всех экранов, чтобы
// «5 редактирований» нигде не читалось как «5 на весь срок подписки».

/** «25 октября» / «25 қазан» — дата сброса в формате языка интерфейса. */
export function formatQuotaResetDate(
  language: string,
  resetsAt: Date | string | null | undefined
): string {
  if (!resetsAt) {
    return "";
  }
  const locale = language === "kk" ? "kk-KZ" : "ru-RU";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(new Date(resetsAt));
}
