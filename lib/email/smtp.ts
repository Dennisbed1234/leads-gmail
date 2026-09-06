import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

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

export async function sendOneEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ messageId?: string }> {
  const { from } = getSmtpConfig();
  const t = getTransporter();

  const info = await t.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html || options.text.replace(/\n/g, '<br>'),
  });

  return { messageId: info.messageId };
}

/** Small delay helper for Gmail-friendly sending */
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
