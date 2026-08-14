import { randomBytes } from "node:crypto";

// Скомпилированные договоры отдаются не base64-строкой в JSON, а обычной
// GET-навигацией на /download/:token с Content-Disposition: attachment —
// iOS WebKit молча игнорирует программный клик по <a download> после
// асинхронного ответа сети (transient user activation истекает за ~1 с),
// поэтому data:-URL + link.click() на айфоне не работает.
//
// Файл живёт в памяти процесса: мутация уже провела проверку доступа и
// списание квоты, токен — «capability» (192 бита случайности), многоразовый
// в пределах ФИКСИРОВАННОГО TTL: кнопка «Скачать» на экране успеха повторно
// ходит по тому же URL. TTL сознательно не продлевается на чтении — ссылка
// из истории браузера или логов не должна жить дольше 10 минут. Перезапуск
// сервера роняет невыданные токены: клиент следит за возрастом токена и
// повторяет мутацию, а мёртвый токен отвечает 204 (см. роут), не выбрасывая
// пользователя из SPA.

const TTL_MS = 10 * 60 * 1000;
const TOKEN_BYTES = 24;
const SWEEP_INTERVAL_MS = 60 * 1000;
// Жёсткий потолок стэша: compile — публичная процедура, без лимита аноним
// мог бы накапливать файлы в памяти до OOM единственного процесса. При
// переполнении вытесняются самые старые записи (Map хранит порядок вставки).
const MAX_ENTRIES = 256;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;

interface StashedDownload {
  bytes: Buffer;
  fileName: string;
  contentType: string;
  expiresAt: number;
}

const stash = new Map<string, StashedDownload>();
let totalBytes = 0;

function removeEntry(token: string): void {
  const entry = stash.get(token);
  if (entry) {
    stash.delete(token);
    totalBytes -= entry.bytes.length;
  }
}

function sweepExpired(now: number): void {
  for (const [token, entry] of stash) {
    if (entry.expiresAt <= now) {
      removeEntry(token);
    }
  }
}

// Фоновая уборка не зависит от трафика: без неё файлы последнего за день
// скачивания висели бы в куче часами. unref — таймер не держит процесс.
setInterval(() => sweepExpired(Date.now()), SWEEP_INTERVAL_MS).unref();

/** Кладёт собранный файл в память и возвращает путь скачивания для клиента. */
export function stashDownload(file: {
  bytes: Buffer;
  fileName: string;
  contentType: string;
}): string {
  const now = Date.now();
  sweepExpired(now);
  while (
    stash.size > 0 &&
    (stash.size >= MAX_ENTRIES ||
      totalBytes + file.bytes.length > MAX_TOTAL_BYTES)
  ) {
    const oldest = stash.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    removeEntry(oldest);
  }
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  stash.set(token, { ...file, expiresAt: now + TTL_MS });
  totalBytes += file.bytes.length;
  return `/download/${token}`;
}

/** Отдаёт файл по токену; протухшие записи удаляет по пути. */
export function takeDownload(token: string): StashedDownload | null {
  const entry = stash.get(token);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    removeEntry(token);
    return null;
  }
  return entry;
}

const NON_ASCII_OR_QUOTE = /[^\x20-\x7e]|["\\]/g;
const RFC5987_EXTRA = /['()*]/g;

/** Content-Disposition c кириллическим именем файла: ASCII-фолбэк в filename=
 * и RFC 5987-кодированный оригинал в filename*= (его читают все современные
 * браузеры, включая iOS Safari). */
export function contentDispositionAttachment(fileName: string): string {
  const ascii = fileName.replace(NON_ASCII_OR_QUOTE, "_");
  const encoded = encodeURIComponent(fileName).replace(
    RFC5987_EXTRA,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
