import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  isSmtpConfigured,
  personalize,
  sendDelayMs,
  sendOneEmail,
  verifySmtpConnection,
  delay,
  getSmtpConfig,
  type EmailAttachment,
} from '@/lib/email/smtp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const MAX_RECIPIENTS = 500;

type Recipient = {
  email: string;
  name?: string;
  company?: string;
  title?: string;
};

function parseRecipients(raw: string): Recipient[] {
  const parts = raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: Recipient[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const angle = part.match(/^(.*?)\s*<\s*([^>]+)\s*>$/);
    let email = part;
    let name: string | undefined;

    if (angle) {
      name = angle[1].replace(/^["']|["']$/g, '').trim() || undefined;
      email = angle[2].trim();
    }

    email = email.toLowerCase();
    if (!EMAIL_RE.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);

    out.push({
      email,
      name: name || email.split('@')[0],
    });
  }

  return out;
}

function normalizeAttachments(raw: unknown): EmailAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: EmailAttachment[] = [];
  for (const item of raw.slice(0, 5)) {
    if (!item || typeof item !== 'object') continue;
    const filename = String((item as any).filename || '').trim();
    let content = String((item as any).content || '').trim();
    const contentType = (item as any).contentType
      ? String((item as any).contentType)
      : undefined;
    if (!filename || !content) continue;
    if (content.includes('base64,')) {
      content = content.split('base64,')[1] || content;
    }
    out.push({ filename, content, contentType });
  }
  return out;
}

function snippet(text?: string, html?: string): string {
  const raw = (text || html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return raw.slice(0, 280);
}

async function logSent(data: {
  toEmail: string;
  toName?: string;
  subject: string;
  bodySnippet?: string;
  status: 'SENT' | 'FAILED';
  messageId?: string;
  error?: string;
  mode?: string;
  isHtml?: boolean;
}) {
  try {
    const { fromName } = getSmtpConfig();
    await prisma.sentEmail.create({
      data: {
        toEmail: data.toEmail,
        toName: data.toName || null,
        subject: data.subject,
        bodySnippet: data.bodySnippet || null,
        status: data.status,
        messageId: data.messageId || null,
        error: data.error || null,
        mode: data.mode || null,
        isHtml: data.isHtml !== false,
        fromName: fromName || 'BOA',
      },
    });
  } catch (e) {
    // Don't fail the campaign if logging fails (e.g. table not pushed yet)
    console.warn('SentEmail log failed:', e);
  }
}

export async function GET() {
  const configured = isSmtpConfigured();
  let verified = false;
  let error: string | undefined;

  if (configured) {
    const result = await verifySmtpConnection();
    verified = result.ok;
    error = result.error;
  }

  return NextResponse.json({
    configured,
    verified,
    error,
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    user: process.env.SMTP_USER || process.env.GMAIL_USER || null,
    maxRecipients: MAX_RECIPIENTS,
  });
}

export async function POST(request: Request) {
  try {
    if (!isSmtpConfigured()) {
      return NextResponse.json(
        {
          error:
            'SMTP not configured. Set SMTP_USER and SMTP_PASS (Gmail App Password) in Vercel env.',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const subjectTemplate = String(body.subject || '').trim();

    const htmlTemplate = String(
      body.htmlBody ?? (body.html !== false ? body.body : '') ?? ''
    ).trim();
    const textTemplate = String(
      body.textBody ?? (body.html === false ? body.body : '') ?? ''
    ).trim();

    const preferHtml = body.html !== false;
    const dryRun = Boolean(body.dryRun);
    const mode = body.mode === 'leads' ? 'leads' : 'manual';
    const toRaw = String(body.to || body.recipients || '').trim();
    const limit = Math.min(
      Math.max(Number(body.limit) || 500, 1),
      MAX_RECIPIENTS
    );
    const statusFilter = body.status || 'NEW';
    const attachments = normalizeAttachments(body.attachments);
    const unsubscribeUrl =
      typeof body.unsubscribeUrl === 'string'
        ? body.unsubscribeUrl.trim()
        : undefined;

    if (!subjectTemplate) {
      return NextResponse.json(
        { error: 'subject is required' },
        { status: 400 }
      );
    }

    if (!htmlTemplate && !textTemplate) {
      return NextResponse.json(
        { error: 'Provide at least htmlBody or textBody (or body)' },
        { status: 400 }
      );
    }

    let recipients: Recipient[] = [];

    if (mode === 'manual') {
      if (!toRaw) {
        return NextResponse.json(
          {
            error:
              'To field is required. Enter one or more emails (comma or new line separated).',
          },
          { status: 400 }
        );
      }
      recipients = parseRecipients(toRaw).slice(0, limit);
      if (recipients.length === 0) {
        return NextResponse.json(
          { error: 'No valid email addresses found in To field' },
          { status: 400 }
        );
      }
    } else {
      const leads = await prisma.lead.findMany({
        where: {
          status: statusFilter,
          email: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      recipients = leads
        .filter((l) => l.email)
        .map((l) => ({
          email: l.email as string,
          name: l.name,
          company: l.company || undefined,
          title: l.title || undefined,
        }));

      if (recipients.length === 0) {
        return NextResponse.json({
          success: true,
          sent: 0,
          failed: 0,
          message: `No leads with status ${statusFilter}`,
        });
      }
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        mode,
        preferHtml,
        hasHtml: Boolean(htmlTemplate),
        hasText: Boolean(textTemplate),
        attachmentCount: attachments.length,
        wouldSend: recipients.length,
        limit,
        recipients: recipients.map((r) => ({
          email: r.email,
          name: r.name,
          subject: personalize(subjectTemplate, {
            name: r.name,
            company: r.company,
            email: r.email,
            title: r.title,
          }),
        })),
      });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const sentTo: string[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const vars = {
        name: r.name,
        company: r.company,
        email: r.email,
        title: r.title,
      };
      const subject = personalize(subjectTemplate, vars);

      try {
        const personalizedHtml = htmlTemplate
          ? personalize(htmlTemplate, vars)
          : undefined;
        const personalizedText = textTemplate
          ? personalize(textTemplate, vars)
          : undefined;

        const html = preferHtml
          ? personalizedHtml || undefined
          : personalizedHtml && !personalizedText
            ? personalizedHtml
            : personalizedHtml || undefined;

        const text =
          personalizedText ||
          (personalizedHtml ? undefined : personalizedText) ||
          undefined;

        const result = await sendOneEmail({
          to: r.email,
          subject,
          html: html || undefined,
          text: text || undefined,
          attachments,
          unsubscribeUrl,
        });

        sent += 1;
        sentTo.push(r.email);

        await logSent({
          toEmail: r.email,
          toName: r.name,
          subject,
          bodySnippet: snippet(text, html),
          status: 'SENT',
          messageId: result.messageId,
          mode,
          isHtml: preferHtml,
        });

        if (mode === 'leads') {
          try {
            await prisma.lead.updateMany({
              where: { email: r.email },
              data: { status: 'CONTACTED' },
            });
          } catch {
            // ignore
          }
        }

        if (i < recipients.length - 1) {
          await delay(sendDelayMs());
        }
      } catch (e: any) {
        failed += 1;
        const errMsg = e?.message || 'send failed';
        errors.push(`${r.email}: ${errMsg}`);

        await logSent({
          toEmail: r.email,
          toName: r.name,
          subject,
          bodySnippet: snippet(
            textTemplate ? personalize(textTemplate, vars) : undefined,
            htmlTemplate ? personalize(htmlTemplate, vars) : undefined
          ),
          status: 'FAILED',
          error: errMsg,
          mode,
          isHtml: preferHtml,
        });

        if (i < recipients.length - 1) {
          await delay(sendDelayMs());
        }
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      preferHtml,
      hasHtml: Boolean(htmlTemplate),
      hasText: Boolean(textTemplate),
      attachmentCount: attachments.length,
      sent,
      failed,
      total: recipients.length,
      limit,
      sentTo,
      errors: errors.slice(0, 15),
      note:
        'Logged to Sent inbox. Max 500/run. Gmail free ~100–500/day.',
    });
  } catch (error: any) {
    console.error('Campaign error:', error);
    return NextResponse.json(
      { error: error?.message || 'Campaign failed' },
      { status: 500 }
    );
  }
}
