import { env } from "@contract-builder/env/server";
import nodemailer, { type Transporter } from "nodemailer";

// Lazily-created singleton transporter (one TCP pool for the process).
let transporter: Transporter | null = null;

/** True when SMTP credentials are configured (otherwise email is skipped). */
export function isMailerConfigured(): boolean {
  return Boolean(env.SMTP_USER && env.SMTP_PASSWORD);
}

function getTransporter(): Transporter {
  if (!(env.SMTP_USER && env.SMTP_PASSWORD)) {
    throw new Error(
      "SMTP не настроен: задайте SMTP_USER и SMTP_PASSWORD (для Gmail — App Password)"
    );
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // Port 465 uses implicit TLS; others (587) upgrade via STARTTLS.
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        // Gmail shows App Passwords with spaces; the SMTP AUTH wants them removed.
        pass: env.SMTP_PASSWORD.replace(/\s+/g, ""),
      },
    });
  }
  return transporter;
}

/** Sends a single email. Throws if SMTP isn't configured or delivery fails. */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const from = env.SMTP_FROM ?? env.SMTP_USER;
  await getTransporter().sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

const escapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const ESCAPE_REGEX = /[&<>"']/g;

export function escapeHtml(value: string): string {
  return value.replace(ESCAPE_REGEX, (char) => escapeMap[char] ?? char);
}

/** Единый HTML-шаблон письма с 6-значным кодом (бренд Zhebe). */
function codeEmailHtml(intro: string, code: string, footer: string): string {
  const safeCode = escapeHtml(code);
  return `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;">
            <tr><td style="font-size:20px;font-weight:bold;color:#53052c;padding-bottom:16px;">Zhebe</td></tr>
            <tr><td style="font-size:16px;line-height:24px;padding-bottom:16px;">
              ${escapeHtml(intro)}
            </td></tr>
            <tr><td style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#18181b;padding-bottom:16px;">
              ${safeCode}
            </td></tr>
            <tr><td style="font-size:14px;line-height:20px;color:#52525b;padding-bottom:24px;">
              Код действует 10 минут.
            </td></tr>
            <tr><td style="font-size:12px;line-height:18px;color:#a1a1aa;">
              ${escapeHtml(footer)}
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Письмо с 6-значным кодом для смены пароля (флоу «Забыли пароль?»).
 * Срок действия кода задаётся настройкой emailOTP-плагина (см. index.ts).
 */
export async function sendPasswordResetEmail(
  to: string,
  code: string
): Promise<void> {
  const footer =
    "Если вы не запрашивали смену пароля — просто проигнорируйте это письмо.";
  await sendMail({
    to,
    subject: "Код для смены пароля в Zhebe",
    text: [
      `Ваш код для смены пароля: ${code}`,
      "Код действует 10 минут.",
      "",
      footer,
    ].join("\n"),
    html: codeEmailHtml("Ваш код для смены пароля:", code, footer),
  });
}

/** Письмо с 6-значным кодом двухфакторной аутентификации (вход и включение 2FA). */
export async function sendTwoFactorEmail(
  to: string,
  code: string
): Promise<void> {
  const footer =
    "Если вы не пытались войти в Zhebe — смените пароль: кто-то знает ваш текущий.";
  await sendMail({
    to,
    subject: "Код для входа в Zhebe",
    text: [
      `Ваш код для входа: ${code}`,
      "Код действует 10 минут.",
      "",
      footer,
    ].join("\n"),
    html: codeEmailHtml("Ваш код для входа:", code, footer),
  });
}

/** Письмо с 6-значным кодом подтверждения удаления аккаунта. */
export async function sendAccountDeleteEmail(
  to: string,
  code: string
): Promise<void> {
  const footer =
    "Если вы не запрашивали удаление аккаунта — не сообщайте код никому и смените пароль.";
  await sendMail({
    to,
    subject: "Код для удаления аккаунта Zhebe",
    text: [
      `Ваш код для удаления аккаунта: ${code}`,
      "Код действует 10 минут.",
      "",
      footer,
    ].join("\n"),
    html: codeEmailHtml("Ваш код для удаления аккаунта:", code, footer),
  });
}

/** Письмо с кодом подтверждения новой почты (смена почты в профиле). */
export async function sendContactVerifyEmail(
  to: string,
  code: string
): Promise<void> {
  const footer =
    "Если вы не меняли почту в Zhebe — просто проигнорируйте это письмо.";
  await sendMail({
    to,
    subject: "Код подтверждения почты в Zhebe",
    text: [
      `Ваш код подтверждения почты: ${code}`,
      "Код действует 10 минут.",
      "",
      footer,
    ].join("\n"),
    html: codeEmailHtml("Ваш код подтверждения почты:", code, footer),
  });
}
