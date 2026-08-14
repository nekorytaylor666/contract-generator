import { env } from "@contract-builder/env/web";

// iOS WebKit молча игнорирует программный клик по <a download> после
// асинхронного ответа сети (transient user activation истекает за ~1 с),
// поэтому файл забирается top-level-навигацией на attachment-эндпоинт
// сервера: браузер показывает системное скачивание, SPA не выгружается,
// user activation для такой навигации не нужна.
export function startFileDownload(downloadPath: string): void {
  window.location.href = `${env.VITE_SERVER_URL}${downloadPath}`;
}
