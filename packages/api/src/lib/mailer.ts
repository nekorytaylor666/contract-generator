import { escapeHtml, sendMail } from "@contract-builder/auth/mailer";
import { env } from "@contract-builder/env/server";

/**
 * Отправляет договор на проверку юристу компании: письмо с данными клиента и
 * PDF текущей версии договора уходит на рабочую почту (LAWYER_EMAIL, по
 * умолчанию — SMTP_USER, т.е. «самому себе»). Reply-To — почта клиента, чтобы
 * юрист мог ответить заключением напрямую.
 */
export async function sendLawyerReviewEmail(opts: {
  clientName: string;
  clientEmail: string;
  orgName: string;
  planName: string;
  documentTitle: string;
  documentId: string | null;
  locale: string;
  pdf: Buffer;
}): Promise<void> {
  const to = env.LAWYER_EMAIL ?? env.SMTP_USER;
  if (!to) {
    throw new Error("Не задана почта для проверок: LAWYER_EMAIL или SMTP_USER");
  }
  const safeName = escapeHtml(opts.clientName);
  const safeEmail = escapeHtml(opts.clientEmail);
  const safeOrg = escapeHtml(opts.orgName);
  const safePlan = escapeHtml(opts.planName);
  const safeTitle = escapeHtml(opts.documentTitle);
  const safeDocId = escapeHtml(opts.documentId ?? "—");
  const safeLocale = escapeHtml(opts.locale);

  const subject = `Договор на проверку: ${opts.documentTitle}`;

  const text = [
    "Клиент отправил договор на проверку юристу.",
    "",
    `Клиент: ${opts.clientName} <${opts.clientEmail}>`,
    `Организация: ${opts.orgName}`,
    `Тариф: ${opts.planName}`,
    `Договор: ${opts.documentTitle}`,
    `ID документа: ${opts.documentId ?? "—"}`,
    `Язык договора: ${opts.locale}`,
    "",
    "Текущая версия договора — во вложении (PDF).",
    "Ответьте на это письмо, чтобы отправить заключение клиенту.",
  ].join("\n");

  const row = (label: string, value: string) =>
    `<tr><td style="font-size:14px;line-height:22px;color:#52525b;padding-right:16px;white-space:nowrap;">${label}</td><td style="font-size:14px;line-height:22px;color:#18181b;">${value}</td></tr>`;

  const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;">
            <tr><td style="font-size:20px;font-weight:bold;color:#53052c;padding-bottom:16px;">Zhebe</td></tr>
            <tr><td style="font-size:16px;line-height:24px;padding-bottom:16px;">
              Клиент отправил договор <strong>«${safeTitle}»</strong> на проверку юристу.
            </td></tr>
            <tr><td style="padding-bottom:24px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                ${row("Клиент", `${safeName} &lt;${safeEmail}&gt;`)}
                ${row("Организация", safeOrg)}
                ${row("Тариф", safePlan)}
                ${row("ID документа", safeDocId)}
                ${row("Язык договора", safeLocale)}
              </table>
            </td></tr>
            <tr><td style="font-size:14px;line-height:20px;color:#52525b;">
              Текущая версия договора — во вложении (PDF).<br />
              Ответьте на это письмо, чтобы отправить заключение клиенту.
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await sendMail({
    to,
    subject,
    html,
    text,
    replyTo: opts.clientEmail,
    attachments: [
      {
        filename: `${opts.documentTitle}.pdf`,
        content: opts.pdf,
        contentType: "application/pdf",
      },
    ],
  });
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
