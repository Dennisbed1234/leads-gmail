import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyEmail, verifyMany } from '@/lib/email/verify';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function statusFor(result: { status: string }) {
  if (result.status === 'valid') return 'VERIFIED';
  if (result.status === 'invalid' || result.status === 'disposable') return 'INVALID';
  return null;
}

export async function GET() {
  return NextResponse.json({
    paidVerifier: Boolean(process.env.ZEROBOUNCE_API_KEY),
    provider: process.env.ZEROBOUNCE_API_KEY ? 'zerobounce' : 'free-mx',
    note: process.env.ZEROBOUNCE_API_KEY
      ? 'ZeroBounce key detected — inbox-level checks enabled.'
      : 'Free mode: syntax + MX + disposable/role. Add ZEROBOUNCE_API_KEY for real inbox verification.',
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const save = body.save !== false;

    if (body.email && typeof body.email === 'string') {
      const result = await verifyEmail(body.email);

      if (save && result.email) {
        const status = statusFor(result);
        await prisma.lead.updateMany({
          where: { email: result.email },
          data: {
            score: result.score,
            ...(status ? { status } : {}),
            notes: result.reason || undefined,
          },
        });
      }

      return NextResponse.json({ success: true, result });
    }

    if (Array.isArray(body.emails)) {
      const emails = body.emails.map(String).slice(0, 50);
      const results = await verifyMany(emails);

      if (save) {
        for (const r of results) {
          try {
            const status = statusFor(r);
            await prisma.lead.updateMany({
              where: { email: r.email },
              data: {
                score: r.score,
                ...(status ? { status } : {}),
                notes: r.reason || undefined,
              },
            });
          } catch {
            // skip
          }
        }
      }

      return NextResponse.json({
        success: true,
        count: results.length,
        results,
        summary: {
          valid: results.filter((r) => r.status === 'valid').length,
          invalid: results.filter((r) =>
            ['invalid', 'disposable'].includes(r.status)
          ).length,
          risky: results.filter((r) =>
            ['risky', 'role', 'unknown'].includes(r.status)
          ).length,
        },
      });
    }

    if (body.fromLeads) {
      const limit = Math.min(Number(body.limit) || 25, 50);
      const leads = await prisma.lead.findMany({
        where: {
          email: { not: null },
          status: { in: ['NEW', 'CONTACTED'] },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      const emails = leads.map((l) => l.email!).filter(Boolean);
      const results = await verifyMany(emails);

      for (const r of results) {
        try {
          const status = statusFor(r);
          await prisma.lead.updateMany({
            where: { email: r.email },
            data: {
              score: r.score,
              ...(status ? { status } : {}),
              notes: r.reason || undefined,
            },
          });
        } catch {
          // skip
        }
      }

      return NextResponse.json({
        success: true,
        count: results.length,
        results,
        summary: {
          valid: results.filter((r) => r.status === 'valid').length,
          invalid: results.filter((r) =>
            ['invalid', 'disposable'].includes(r.status)
          ).length,
          risky: results.filter((r) =>
            ['risky', 'role', 'unknown'].includes(r.status)
          ).length,
        },
      });
    }

    return NextResponse.json(
      { error: 'Provide email, emails[], or fromLeads:true' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Verification failed' },
      { status: 500 }
    );
  }
}
