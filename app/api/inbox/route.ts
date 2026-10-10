import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ensureSentEmailTable } from '@/lib/db/ensure-sent-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isMissingTableError(error: any): boolean {
  const msg = String(error?.message || error || '');
  return (
    /sentEmail/i.test(msg) ||
    /SentEmail/i.test(msg) ||
    /does not exist/i.test(msg) ||
    /P2021/i.test(msg)
  );
}

function sinceDate(days: number): Date | null {
  if (!days || days <= 0) return null;
  const d = new Date();
  d.setTime(d.getTime() - days * 24 * 60 * 60 * 1000);
  return d;
}

async function loadStats(dateWhere: any) {
  const base = dateWhere || {};
  const [total, sentCount, failedCount, deliveredCount, openedCount, clickedCount] =
    await Promise.all([
      prisma.sentEmail.count({ where: base }),
      prisma.sentEmail.count({
        where: {
          ...base,
          status: { in: ['SENT', 'DELIVERED', 'OPENED'] },
        },
      }),
      prisma.sentEmail.count({
        where: { ...base, status: 'FAILED' },
      }),
      prisma.sentEmail.count({
        where: {
          ...base,
          status: { in: ['DELIVERED', 'OPENED'] },
        },
      }),
      prisma.sentEmail.count({
        where: { ...base, status: 'OPENED' },
      }),
      // Emails that have been clicked at least once (lastEvent or clickCount)
      prisma.sentEmail.count({
        where: {
          ...base,
          OR: [
            { lastEvent: 'clicked' },
            { clickCount: { gt: 0 } },
          ],
        },
      }),
    ]);
  return { total, sentCount, failedCount, deliveredCount, openedCount, clickedCount };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const daysRaw = Number(searchParams.get('days') || 0);
    const days = [1, 2, 3, 7, 14, 30].includes(daysRaw) ? daysRaw : 0;
    const take = Math.min(
      Math.max(Number(searchParams.get('limit')) || 50000, 1),
      50000
    );
    const setup = searchParams.get('setup') === '1';

    if (setup) {
      const result = await ensureSentEmailTable();
      if (!result.ok) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Could not create SentEmail table',
            hint: 'Check DATABASE_URL on Vercel points to your Neon/Postgres DB.',
          },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        setup: true,
        message: 'SentEmail table is ready.',
      });
    }

    const since = sinceDate(days);
    const dateWhere = since ? { createdAt: { gte: since } } : {};

    const where: any = { ...dateWhere };
    if (status === 'FAILED') {
      where.status = 'FAILED';
    } else if (status === 'OPENED') {
      where.status = 'OPENED';
    } else if (status === 'CLICKED') {
      where.OR = [
        { lastEvent: 'clicked' },
        { clickCount: { gt: 0 } },
      ];
    } else if (status === 'DELIVERED') {
      where.status = { in: ['DELIVERED', 'OPENED'] };
    } else if (status === 'SENT') {
      where.status = { in: ['SENT', 'DELIVERED', 'OPENED'] };
    }
    if (q) {
      where.OR = [
        ...(where.OR || []),
        { toEmail: { contains: q, mode: 'insensitive' } },
        { toName: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
      ];
    }

    try {
      const [items, filteredTotal, stats] = await Promise.all([
        prisma.sentEmail.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
        }),
        prisma.sentEmail.count({ where }),
        loadStats(dateWhere),
      ]);

      return NextResponse.json({
        success: true,
        total: filteredTotal,
        loaded: items.length,
        days: days || null,
        ...stats,
        items,
      });
    } catch (inner: any) {
      if (!isMissingTableError(inner)) throw inner;

      const ensured = await ensureSentEmailTable();
      if (!ensured.ok) {
        return NextResponse.json({
          success: true,
          total: 0,
          sentCount: 0,
          failedCount: 0,
          deliveredCount: 0,
          openedCount: 0,
          clickedCount: 0,
          items: [],
          needsSetup: true,
          note:
            'SentEmail table is missing. Tap “Create table” below, or check DATABASE_URL.',
          setupError: ensured.error,
        });
      }

      const [items, filteredTotal, stats] = await Promise.all([
        prisma.sentEmail.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
        }),
        prisma.sentEmail.count({ where }),
        loadStats(dateWhere),
      ]);

      return NextResponse.json({
        success: true,
        total: filteredTotal,
        loaded: items.length,
        days: days || null,
        ...stats,
        items,
        note: 'SentEmail table was created automatically.',
      });
    }
  } catch (error: any) {
    console.error('Inbox list error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load inbox' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.setup || body.createTable) {
      const result = await ensureSentEmailTable();
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error || 'Create table failed' },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'SentEmail table is ready. Refresh inbox.',
      });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Setup failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = body.id ? String(body.id) : null;
    const clearAll = Boolean(body.clearAll);

    if (clearAll) {
      await prisma.sentEmail.deleteMany({});
      return NextResponse.json({ success: true, cleared: true });
    }

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    await prisma.sentEmail.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: id });
  } catch (error: any) {
    if (isMissingTableError(error)) {
      await ensureSentEmailTable();
      return NextResponse.json({
        success: true,
        message: 'Table created; nothing to delete yet.',
      });
    }
    return NextResponse.json(
      { error: error?.message || 'Delete failed' },
      { status: 500 }
    );
  }
}
