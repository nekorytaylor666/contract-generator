// Мостик между модалкой скачивания и страницами возврата Robokassa
// (/success/payment, /fail/payment): перед редиректом на оплату модалка
// запоминает контекст, а страницы возврата по нему возвращают пользователя
// на страницу шаблона и снова открывают модалку в нужном состоянии.

// purchase/upgrade — модалка скачивания; edit/edit-upgrade — модалка
// редактирования (разовая покупка либо повышение тарифа из неё).
export type DownloadReturnFlow =
  | "purchase"
  | "upgrade"
  | "edit"
  | "edit-upgrade";

export interface DownloadReturn {
  templateId: string;
  /** InvId создаваемого платежа (из ссылки Robokassa) — защита от чужих
   * платежей: возврат срабатывает только для «своего» invId. */
  invId: number | null;
  format: "pdf" | "docx";
  flow: DownloadReturnFlow;
  /** Для flow=upgrade: выбранный тариф, чтобы «Попробовать снова» повторил
   * тот же чекаут. */
  planId?: string;
}

/** Контекст возврата с оплаты: страница шаблона собирает его из
 * search-параметров (?payInvId / ?payFailed), и модалка скачивания
 * открывается сразу в нужном платёжном состоянии. */
export interface InitialPayment {
  invId: number | null;
  failed: boolean;
}

const STORAGE_KEY = "template-download-return";

export function saveDownloadReturn(value: DownloadReturn): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function readDownloadReturn(): DownloadReturn | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DownloadReturn;
    return typeof parsed?.templateId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDownloadReturn(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
