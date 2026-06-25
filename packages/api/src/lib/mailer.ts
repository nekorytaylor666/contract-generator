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

function escapeHtml(value: string): string {
  return value.replace(ESCAPE_REGEX, (char) => escapeMap[char] ?? char);
}

/**
 * Sends a team invitation email with a link to accept. The link points at the
 * frontend accept page, which calls the `team.acceptInvite` mutation.
 */
export async function sendTeamInvitationEmail(opts: {
  to: string;
  orgName: string;
  inviterName: string;
  roleLabel: string;
  acceptUrl: string;
}): Promise<void> {
  const { to, orgName, inviterName, roleLabel, acceptUrl } = opts;
  const safeOrg = escapeHtml(orgName);
  const safeInviter = escapeHtml(inviterName);
  const safeRole = escapeHtml(roleLabel);
  const safeUrl = escapeHtml(acceptUrl);

  const subject = `Приглашение в команду «${orgName}» в Zhebe`;

  const text = [
    `${inviterName} приглашает вас в команду «${orgName}» в Zhebe.`,
    `Уровень доступа: ${roleLabel}.`,
    "",
    "Чтобы принять приглашение, перейдите по ссылке:",
    acceptUrl,
    "",
    "Если вы не ожидали это письмо — просто проигнорируйте его.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;">
            <tr><td style="font-size:20px;font-weight:bold;color:#53052c;padding-bottom:16px;">Zhebe</td></tr>
            <tr><td style="font-size:16px;line-height:24px;padding-bottom:16px;">
              <strong>${safeInviter}</strong> приглашает вас в команду
              <strong>«${safeOrg}»</strong>.
            </td></tr>
            <tr><td style="font-size:14px;line-height:20px;color:#52525b;padding-bottom:24px;">
              Уровень доступа: ${safeRole}.
            </td></tr>
            <tr><td style="padding-bottom:24px;">
              <a href="${safeUrl}" style="display:inline-block;background:#53052c;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:8px;">
                Принять приглашение
              </a>
            </td></tr>
            <tr><td style="font-size:12px;line-height:18px;color:#a1a1aa;">
              Если кнопка не работает, скопируйте ссылку в браузер:<br />
              <a href="${safeUrl}" style="color:#53052c;">${safeUrl}</a>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await sendMail({ to, subject, html, text });
}
