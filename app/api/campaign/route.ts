import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  delay,
  isSmtpConfigured,
  personalize,
  sendOneEmail,
  verifySmtpConnection,
} from '@/lib/email/smtp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

type Recipient = {
  email: string;
  name?: string;
  company?: string;
  title?: string;
};

/** Parse To field: one email per line, or comma-separated. Supports "Name <email@x.com>" */
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
    const bodyTemplate = String(body.body || '').trim();
    const dryRun = Boolean(body.dryRun);
    const mode = body.mode === 'leads' ? 'leads' : 'manual';
    const toRaw = String(body.to || body.recipients || '').trim();
    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 50);
    const statusFilter = body.status || 'NEW';

    if (!subjectTemplate || !bodyTemplate) {
      return NextResponse.json(
        { error: 'subject and body are required' },
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
        wouldSend: recipients.length,
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

    for (const r of recipients) {
      try {
        const vars = {
          name: r.name,
          company: r.company,
          email: r.email,
          title: r.title,
        };

        await sendOneEmail({
          to: r.email,
          subject: personalize(subjectTemplate, vars),
          text: personalize(bodyTemplate, vars),
        });

        sent += 1;
        sentTo.push(r.email);

        // Mark DB lead contacted when sending from leads mode
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

        await delay(2000);
      } catch (e: any) {
        failed += 1;
        errors.push(`${r.email}: ${e?.message || 'send failed'}`);
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      sent,
      failed,
      total: recipients.length,
      sentTo,
      errors: errors.slice(0, 15),
      note: 'Gmail free accounts have daily send limits (~100–500).',
    });
  } catch (error: any) {
    console.error('Campaign error:', error);
    return NextResponse.json(
      { error: error?.message || 'Campaign failed' },
      { status: 500 }
    );
  }
}
