import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { randomBytes } from 'crypto';

let transporter: Transporter | null = null;

export type EmailAttachment = {
  filename: string;
  content: string; // base64
  contentType?: string;
};

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
  const fromName =
    process.env.SMTP_FROM_NAME ||
    process.env.FROM_NAME ||
    'LeadBot';
  const replyTo =
    process.env.SMTP_REPLY_TO ||
    process.env.REPLY_TO ||
    fromEmail;

  // "Display Name <email@domain>" — better inbox placement than bare address
  const from =
    fromName && fromEmail
      ? `"${fromName.replace(/["\\]/g, '')}" <${fromEmail}>`
      : fromEmail;

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
    // Prefer TLS on 587; pool off for serverless
    tls: {
      // Do not fail on self-signed (some corporate relays)
      rejectUnauthorized: process.env.SMTP_TLS_REJECT !== '0',
      minVersion: 'TLSv1.2',
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
  const id = randomBytes(12).toString('hex');
  return `<${id}@${domain}>`;
}

/**
 * Send one email with deliverability-oriented defaults:
 * - multipart/alternative (text + html)
 * - Display-name From + Reply-To
 * - List-Unsubscribe (improves inbox placement with many providers)
 * - Proper UTF-8 + Message-ID
 */
export async function sendOneEmail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  /** Optional unsubscribe URL for List-Unsubscribe header */
  unsubscribeUrl?: string;
}): Promise<{ messageId?: string }> {
  const { from, fromEmail, replyTo } = getSmtpConfig();
  const t = getTransporter();

  // Always produce both parts when possible (multipart/alternative scores better)
  let html =
    options.html ||
    (options.text
      ? `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111">${options.text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')}</div>`
      : undefined);

  let text =
    options.text || (options.html ? stripHtml(options.html) : '');

  // Soften common spam triggers in subject (leading RE:/FW: spammy, all-caps, etc.)
  let subject = options.subject.trim();
  if (subject === subject.toUpperCase() && subject.length > 8) {
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
    options.unsubscribeUrl ||
    process.env.SMTP_UNSUBSCRIBE_URL ||
    undefined;

  const headers: Record<string, string> = {
    // Helps some filters treat mail as personal/transactional rather than bulk blast
    'X-Entity-Ref-ID': randomBytes(8).toString('hex'),
  };

  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  // Prefer one-to-one style: single To, no BCC, no Precedence:bulk
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
    // Avoid advertising a bulk mailer signature
    // nodemailer sets X-Mailer by default; override to something neutral
  });

  return { messageId: info.messageId };
}

/** Jittered delay — reduces bulk-send fingerprints */
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function sendDelayMs(): number {
  // 3–7 seconds between messages (Gmail is sensitive to rapid sequential sends)
  const base = parseInt(process.env.SMTP_SEND_DELAY_MS || '4000', 10);
  const jitter = Math.floor(Math.random() * 3000);
  return Math.max(2500, base + jitter);
}
