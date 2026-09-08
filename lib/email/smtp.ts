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

function sanitizeSubject(subject: string): string {
  let s = subject.trim();
  if (s === s.toUpperCase() && s.length > 8) {
    s = s.charAt(0) + s.slice(1).toLowerCase();
  }
  s = s.replace(/!{2,}/g, '!');
  s = s.replace(/\${2,}/g, '$');
  return s.slice(0, 150);
}

function extractEmail(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  const angle = s.match(/<([^>]+@[^>]+)>/);
  if (angle) return angle[1].trim().toLowerCase();
  const plain = s.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (plain) return plain[0].toLowerCase();
  return s.includes('@') ? s.toLowerCase() : '';
}

function cleanDisplayName(raw: string, fallback = 'CHASE'): string {
  let s = (raw || '').trim();
  if (!s) return fallback;
  s = s.replace(/[<>"']/g, '');
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[\s:>\-]+|[\s:<>\-]+$/g, '').trim();
  if (!s || s.length > 40) return fallback;
  return s;
}

export function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = extractEmail(
    process.env.SMTP_USER || process.env.GMAIL_USER || ''
  );
  const pass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').trim();

  let fromEmail =
    extractEmail(
      process.env.SMTP_FROM || process.env.GMAIL_USER || user || ''
    ) || user;

  // Chase Global — display as CHASE
  const fromName = cleanDisplayName(
    process.env.SMTP_FROM_NAME || process.env.FROM_NAME || 'CHASE',
    'CHASE'
  );

  const replyTo =
    extractEmail(process.env.SMTP_REPLY_TO || process.env.REPLY_TO || '') ||
    fromEmail;

  const envelopeFrom = extractEmail(
    process.env.SMTP_ENVELOPE_FROM || process.env.SMTP_RETURN_PATH || ''
  );

  const from =
    fromName && fromEmail
      ? { name: fromName, address: fromEmail }
      : fromEmail;

  const domain = fromEmail.includes('@')
    ? fromEmail.split('@')[1].toLowerCase()
    : '';

  const isGmail =
    host.includes('gmail.com') ||
    host.includes('googlemail.com') ||
    user.endsWith('@gmail.com') ||
    user.endsWith('@googlemail.com');

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
    isGmail,
  };
}

export function isSmtpConfigured(): boolean {
  const { user, pass } = getSmtpConfig();
  return Boolean(user && pass);
}

export function resetTransporter() {
  transporter = null;
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
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    name: process.env.SMTP_HELO || process.env.SMTP_HOSTNAME || undefined,
  });

  return transporter;
}

export async function verifySmtpConnection(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    resetTransporter();
    const t = getTransporter();
    await t.verify();
    return { ok: true };
  } catch (e: any) {
    resetTransporter();
    return {
      ok: false,
      error: formatSmtpError(e),
    };
  }
}

function formatSmtpError(e: any): string {
  const raw = String(e?.response || e?.message || e || 'SMTP error');
  const code = e?.responseCode || e?.code || '';

  if (/Invalid login|EAUTH|535/i.test(raw) || code === 'EAUTH') {
    return (
      'SMTP login failed. For Gmail: use an App Password (not your normal password), ' +
      'enable 2FA, set SMTP_USER to the full Gmail address and SMTP_PASS to the 16-char App Password.'
    );
  }
  if (/Daily.*limit|User-rate limit|421-4\.7\.0|421 4\.7\.0/i.test(raw)) {
    return 'SMTP rate/limit error from provider. Wait and send smaller batches.';
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ESOCKET/i.test(raw) || code === 'ESOCKET') {
    return `Cannot reach SMTP host (${raw}). Check SMTP_HOST / SMTP_PORT / firewall.`;
  }
  if (/550|553|Sender.*not|not allowed|does not match/i.test(raw)) {
    return (
      'Provider rejected the From/envelope address. ' +
      'With Gmail, SMTP_FROM must be the same Gmail account (or an alias on that account). ' +
      `Detail: ${raw.slice(0, 200)}`
    );
  }
  return raw.slice(0, 400);
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

  if (html && stripHtml(html).length < 20) {
    text =
      text.length > 5
        ? text
        : 'Hello,\n\nPlease see this message.\n\nRegards,\nCHASE';
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
    'X-Entity-Ref-ID': randHex(12),
  };

  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  let envelope: { from: string; to: string } | undefined;
  if (cfg.envelopeFrom) {
    if (cfg.isGmail) {
      const envLower = cfg.envelopeFrom.toLowerCase();
      const userLower = cfg.user.toLowerCase();
      if (envLower === userLower || envLower.endsWith('@gmail.com')) {
        envelope = { from: cfg.envelopeFrom, to: options.to };
      }
    } else {
      envelope = { from: cfg.envelopeFrom, to: options.to };
    }
  }

  try {
    const info = await t.sendMail({
      from: cfg.from,
      envelope,
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
      priority: 'normal',
    });

    return { messageId: info.messageId };
  } catch (e: any) {
    if (/EAUTH|Invalid login|535/i.test(String(e?.message || e?.code || ''))) {
      resetTransporter();
    }
    throw new Error(formatSmtpError(e));
  }
}

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function sendDelayMs(): number {
  const base = parseInt(process.env.SMTP_SEND_DELAY_MS || '4000', 10);
  const jitter = Math.floor(Math.random() * 3000);
  return Math.max(2500, (Number.isFinite(base) ? base : 4000) + jitter);
}
