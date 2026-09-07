import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

export type EmailAttachment = {
  filename: string;
  content: string; // base64
  contentType?: string;
};

function randHex(bytes: number): string {
  // Avoid hard crypto import issues on some serverless builds
  const alphabet = 'abcdef0123456789';
  let out = '';
  for (let i = 0; i < bytes * 2; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function getSmtpConfig() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER || '';
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
  const fromEmail =
    process.env.SMTP_FROM ||
    process.env.GMAIL_USER ||
    user ||
    '';
  // BIG OLD ALPS — use initials so recipients don't think mail is from a bot
  const fromName = (
    process.env.SMTP_FROM_NAME ||
    process.env.FROM_NAME ||
    'BOA'
  ).replace(/["\\]/g, '');
  const replyTo =
    process.env.SMTP_REPLY_TO ||
    process.env.REPLY_TO ||
    fromEmail;

  const from =
    fromName && fromEmail ? `"${fromName}" <${fromEmail}>` : fromEmail;

  return { host, port, user, pass, from, fromEmail, fromName, replyTo };
}

export function isSmtpConfigured(): boolean {
  const { user, pass } = getSmtpConfig();
  return Boolean(user && pass);
}

export function getTransporter(): Transporter {
  if (transporter) return transporter;

  const { host, port, user, pass } = getSmtpConfig();

  if (!user || !pass) {
    throw new Error(
      'SMTP not configured. Set SMTP_USER and SMTP_PASS (Gmail App Password) on Vercel.'
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT !== '0',
    },
  });

  return transporter;
}

export async function verifySmtpConnection(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const t = getTransporter();
    await t.verify();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'SMTP verify failed' };
  }
}

export function personalize(
  template: string,
  vars: Record<string, string | undefined | null>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return vars[key] ?? '';
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeMessageId(fromEmail: string): string {
  const domain = (fromEmail.split('@')[1] || 'localhost').toLowerCase();
  return `<${randHex(12)}@${domain}>`;
}

/**
 * Deliverability-focused send:
 * - multipart text + html
 * - named From + Reply-To
 * - List-Unsubscribe when configured
 * - Message-ID / Date / UTF-8
 */
export async function sendOneEmail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  unsubscribeUrl?: string;
}): Promise<{ messageId?: string }> {
  const { from, fromEmail, replyTo } = getSmtpConfig();
  const t = getTransporter();

  const html =
    options.html ||
    (options.text
      ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111111">${options.text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')}</div>`
      : undefined);

  const text =
    options.text || (options.html ? stripHtml(options.html) : '') || ' ';

  let subject = (options.subject || '').trim();
  if (subject && subject === subject.toUpperCase() && subject.length > 8) {
    subject = subject.charAt(0) + subject.slice(1).toLowerCase();
  }

  const attachments =
    options.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType,
    })) || [];

  const totalBytes = attachments.reduce((n, a) => n + a.content.length, 0);
  if (totalBytes > 8 * 1024 * 1024) {
    throw new Error('Attachments too large (max ~8MB total for this app)');
  }

  const unsubscribeUrl =
    options.unsubscribeUrl || process.env.SMTP_UNSUBSCRIBE_URL || undefined;

  const headers: Record<string, string> = {
    'X-Entity-Ref-ID': randHex(8),
  };

  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  const info = await t.sendMail({
    from,
    to: options.to,
    replyTo: replyTo || fromEmail,
    subject,
    text,
    html,
    attachments,
    messageId: makeMessageId(fromEmail || 'mail.local'),
    date: new Date(),
    encoding: 'utf-8',
    headers,
  });

  return { messageId: info.messageId };
}

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function sendDelayMs(): number {
  const base = parseInt(process.env.SMTP_SEND_DELAY_MS || '4000', 10);
  const jitter = Math.floor(Math.random() * 3000);
  return Math.max(2500, (Number.isFinite(base) ? base : 4000) + jitter);
}
