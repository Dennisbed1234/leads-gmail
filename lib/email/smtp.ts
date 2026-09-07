import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

export type EmailAttachment = {
  filename: string;
  content: string; // base64
  contentType?: string;
};

function randHex(bytes: number): string {
  const alphabet = 'abcdef0123456789';
  let out = '';
  for (let i = 0; i < bytes * 2; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Soften phrases that SpamAssassin / Gmail score heavily */
function sanitizeSubject(subject: string): string {
  let s = subject.trim();
  if (s === s.toUpperCase() && s.length > 8) {
    s = s.charAt(0) + s.slice(1).toLowerCase();
  }
  // Strip excessive punctuation / money spam patterns
  s = s.replace(/!{2,}/g, '!');
  s = s.replace(/\${2,}/g, '$');
  return s.slice(0, 150);
}

function looksLikeSpammyHtml(html: string): boolean {
  const lower = html.toLowerCase();
  const bad = [
    'click here now',
    'act now',
    'limited time offer',
    'congratulations you won',
    'viagra',
    'crypto giveaway',
  ];
  return bad.some((b) => lower.includes(b));
}

export function getSmtpConfig() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER || '';
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';

  // Prefer company domain address when set (critical for SPF/DKIM alignment)
  const fromEmail = (
    process.env.SMTP_FROM ||
    process.env.GMAIL_USER ||
    user ||
    ''
  ).trim();

  const fromName = (
    process.env.SMTP_FROM_NAME ||
    process.env.FROM_NAME ||
    'BOA'
  )
    .replace(/["\\]/g, '')
    .trim();

  const replyTo = (
    process.env.SMTP_REPLY_TO ||
    process.env.REPLY_TO ||
    fromEmail
  ).trim();

  // Envelope sender (Return-Path) — should match From domain for DMARC alignment
  const envelopeFrom = (
    process.env.SMTP_ENVELOPE_FROM ||
    process.env.SMTP_RETURN_PATH ||
    fromEmail
  ).trim();

  const from =
    fromName && fromEmail ? `"${fromName}" <${fromEmail}>` : fromEmail;

  const domain = fromEmail.includes('@')
    ? fromEmail.split('@')[1].toLowerCase()
    : '';

  return {
    host,
    port,
    user,
    pass,
    from,
    fromEmail,
    fromName,
    replyTo,
    envelopeFrom,
    domain,
  };
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
      'SMTP not configured. Set SMTP_USER and SMTP_PASS on Vercel.'
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
    // Helps some providers treat connection as modern client
    name: process.env.SMTP_HELO || process.env.SMTP_HOSTNAME || undefined,
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

function makeMessageId(domain: string): string {
  const d = domain || 'localhost';
  return `<${randHex(16)}.${Date.now()}@${d}>`;
}

/**
 * Stronger deliverability defaults for BOA / company domain SMTP.
 * DNS (SPF + DKIM + DMARC) still does most of the work — code alone cannot “bypass” filters.
 */
export async function sendOneEmail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  unsubscribeUrl?: string;
}): Promise<{ messageId?: string }> {
  const cfg = getSmtpConfig();
  const t = getTransporter();

  // Always try to provide BOTH text + html (multipart/alternative)
  let html =
    options.html ||
    (options.text
      ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222222">${options.text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')}</div>`
      : undefined);

  let text =
    options.text || (options.html ? stripHtml(options.html) : '') || '.';

  // Avoid empty or image-only bodies (high spam score)
  if (html && stripHtml(html).length < 20) {
    text = text.length > 5 ? text : 'Hello,\n\nPlease see this message.\n\nRegards,\nBOA';
  }

  if (html && looksLikeSpammyHtml(html)) {
    console.warn(
      'Content may trigger spam filters (aggressive promo language detected)'
    );
  }

  const subject = sanitizeSubject(options.subject || 'Hello');

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
    // Unique ref without looking like a bulk ESP blast
    'X-Entity-Ref-ID': randHex(12),
    // Encourage transactional treatment where supported
    'X-Auto-Response-Suppress': 'OOF, AutoReply',
  };

  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  // Optional List-Id for domain-owned mail
  if (cfg.domain) {
    headers['List-Id'] = `<outreach.${cfg.domain}>`;
  }

  const info = await t.sendMail({
    from: cfg.from,
    // Align Return-Path / envelope with From domain when possible
    envelope: cfg.envelopeFrom
      ? { from: cfg.envelopeFrom, to: options.to }
      : undefined,
    to: options.to,
    replyTo: cfg.replyTo || cfg.fromEmail,
    subject,
    text,
    html,
    attachments,
    messageId: makeMessageId(cfg.domain || 'mail.local'),
    date: new Date(),
    encoding: 'utf-8',
    headers,
    // Priority normal — “high priority” is a spam signal
    priority: 'normal',
  });

  return { messageId: info.messageId };
}

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function sendDelayMs(): number {
  const base = parseInt(process.env.SMTP_SEND_DELAY_MS || '5000', 10);
  const jitter = Math.floor(Math.random() * 4000);
  return Math.max(3000, (Number.isFinite(base) ? base : 5000) + jitter);
}
