import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';

// Email over SMTP from Quality Tools' shared mailbox - the same SMTP_PASS
// secret and settings as PeraForm's functions/mail.js (one project). Set
// SMTP_HOST and SMTP_USER in functions/.env. Until they're set, sendMail
// logs and skips (returns false).
export const SMTP_PASS = defineSecret('SMTP_PASS');
const SMTP_HOST = defineString('SMTP_HOST', { default: 'smtp.gmail.com' });
const SMTP_USER = defineString('SMTP_USER', { default: '' });

export const APP_URL = 'https://hypercbt-qt.web.app';

let transport;

export async function sendMail({ to, subject, text, html }) {
  const user = SMTP_USER.value();
  const pass = SMTP_PASS.value();
  if (!user || !pass || pass === 'none') {
    logger.info('Email not configured, skipping', { subject });
    return false;
  }
  // Loaded only when an email is actually sent (keeps cold starts fast).
  const { default: nodemailer } = await import('nodemailer');
  transport ??= nodemailer.createTransport({ host: SMTP_HOST.value(), port: 465, secure: true, auth: { user, pass } });
  await transport.sendMail({
    from: `HyperCBT (No-Reply) <${user}>`,
    replyTo: 'HyperCBT (No-Reply) <noreply@hypercbt-qt.web.app>',
    to,
    subject,
    text,
    html,
  });
  return true;
}

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// PeraForm's email layout in HyperCBT's orange: a heading, the body, an
// optional button and footer.
export function emailHtml({ heading, body, cta, href, footer }) {
  const paragraphs = String(body ?? '')
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#3d4049">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const button =
    cta && href
      ? `<p style="margin:8px 0 0"><a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 20px;border-radius:999px;background:#b85a00;color:#fff;text-decoration:none;font-weight:600;font-size:14px">${escapeHtml(cta)}</a></p>`
      : '';
  const foot = footer ? `<p style="margin:24px 0 0;font-size:12px;color:#6b6f7b">${escapeHtml(footer)}</p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#fbfcff;font-family:Inter,Segoe UI,Arial,sans-serif;color:#14151a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #eceef3;border-radius:12px;border-top:6px solid #ea7a10">
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#6b6f7b">HyperCBT (No-Reply)</p>
<h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(heading)}</h1>
${paragraphs}${button}${foot}
</td></tr></table></td></tr></table></body></html>`;
}
