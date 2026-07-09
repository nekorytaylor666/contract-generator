/**
 * Dev-only: any uncaught error / unhandled rejection paints its message on top
 * of the page, so a "white screen" always shows WHY. No-op in production.
 */
const MAX_ERRORS = 5;
let shown = 0;

function paint(title: string, detail: string) {
  if (shown >= MAX_ERRORS) {
    return;
  }
  shown++;
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;" +
    "background:#7f1d1d;color:#fff;padding:12px 16px;border-radius:8px;" +
    "font:12px/1.5 monospace;white-space:pre-wrap;max-height:40vh;overflow:auto;" +
    "box-shadow:0 8px 24px rgba(0,0,0,.4)";
  box.textContent = `⛔ ${title}\n${detail}`;
  const close = document.createElement("button");
  close.textContent = "×";
  close.style.cssText =
    "position:absolute;top:6px;right:10px;background:none;border:none;color:#fff;font-size:16px;cursor:pointer";
  close.onclick = () => box.remove();
  box.appendChild(close);
  document.body.appendChild(box);
}

export function installDevErrorOverlay() {
  if (!import.meta.env.DEV) {
    return;
  }
  window.addEventListener("error", (event) => {
    paint(
      event.message || "Uncaught error",
      (event.error?.stack ?? `${event.filename}:${event.lineno}`) || ""
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as Error | undefined;
    paint(
      `Unhandled rejection: ${reason?.message ?? String(event.reason)}`,
      reason?.stack ?? ""
    );
  });
}
