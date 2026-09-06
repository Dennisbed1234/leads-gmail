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
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);
    const statusFilter = body.status || 'NEW';
    const testTo = body.testTo ? String(body.testTo).trim() : '';
    const dryRun = Boolean(body.dryRun);

    if (!subjectTemplate || !bodyTemplate) {
      return NextResponse.json(
        { error: 'subject and body are required' },
        { status: 400 }
      );
    }

    // Test email to yourself
    if (testTo) {
      if (dryRun) {
        return NextResponse.json({
          success: true,
          dryRun: true,
          sent: 0,
          message: `Would send test to ${testTo}`,
        });
      }

      await sendOneEmail({
        to: testTo,
        subject: personalize(subjectTemplate, {
          name: 'Test',
          company: 'Test Co',
          email: testTo,
        }),
        text: personalize(bodyTemplate, {
          name: 'Test',
          company: 'Test Co',
          email: testTo,
        }),
      });

      return NextResponse.json({
        success: true,
        sent: 1,
        failed: 0,
        test: true,
        to: testTo,
      });
    }

    const leads = await prisma.lead.findMany({
      where: {
        status: statusFilter,
        email: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (leads.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        message: `No leads with status ${statusFilter}`,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        wouldSend: leads.length,
        sample: leads.slice(0, 5).map((l) => ({
          name: l.name,
          email: l.email,
          subject: personalize(subjectTemplate, {
            name: l.name,
            company: l.company,
            email: l.email,
          }),
        })),
      });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      if (!lead.email) continue;

      try {
        const vars = {
          name: lead.name,
          company: lead.company,
          email: lead.email,
          title: lead.title,
        };

        await sendOneEmail({
          to: lead.email,
          subject: personalize(subjectTemplate, vars),
          text: personalize(bodyTemplate, vars),
        });

        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: 'CONTACTED' },
        });

        sent += 1;

        // Gmail-friendly pacing (~1 email / 2s)
        await delay(2000);
      } catch (e: any) {
        failed += 1;
        errors.push(`${lead.email}: ${e?.message || 'send failed'}`);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: leads.length,
      errors: errors.slice(0, 10),
      note: 'Gmail free accounts have daily send limits (~100–500). Use App Passwords, not your normal password.',
    });
  } catch (error: any) {
    console.error('Campaign error:', error);
    return NextResponse.json(
      { error: error?.message || 'Campaign failed' },
      { status: 500 }
    );
  }
}
