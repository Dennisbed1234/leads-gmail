import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

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
  const from =
    process.env.SMTP_FROM ||
    process.env.GMAIL_USER ||
    user ||
    '';

  return { host, port, user, pass, from };
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
    .replace(/\s+/g, ' ')
    .trim();
}

export async function sendOneEmail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}): Promise<{ messageId?: string }> {
  const { from } = getSmtpConfig();
  const t = getTransporter();

  const html =
    options.html ||
    (options.text ? options.text.replace(/\n/g, '<br>') : undefined);
  const text =
    options.text || (options.html ? stripHtml(options.html) : '');

  const attachments =
    options.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType,
    })) || [];

  // Gmail practical limit ~25MB total; keep under 10MB payload for Vercel
  const totalBytes = attachments.reduce((n, a) => n + a.content.length, 0);
  if (totalBytes > 8 * 1024 * 1024) {
    throw new Error('Attachments too large (max ~8MB total for this app)');
  }

  const info = await t.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text,
    html,
    attachments,
  });

  return { messageId: info.messageId };
}

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
