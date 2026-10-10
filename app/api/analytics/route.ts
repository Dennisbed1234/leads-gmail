import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ensureSentEmailTable } from '@/lib/db/ensure-sent-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SUCCESS = ['SENT', 'DELIVERED', 'OPENED'] as const;

export async function GET() {
  try {
    await ensureSentEmailTable();

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      total,
      sent,
      failed,
      delivered,
      opened,
      clicked,
      today,
      last7,
      recent,
    ] = await Promise.all([
      prisma.sentEmail.count(),
      prisma.sentEmail.count({ where: { status: { in: [...SUCCESS] } } }),
      prisma.sentEmail.count({ where: { status: 'FAILED' } }),
      prisma.sentEmail.count({
        where: { status: { in: ['DELIVERED', 'OPENED'] } },
      }),
      prisma.sentEmail.count({ where: { status: 'OPENED' } }),
      prisma.sentEmail.count({
        where: {
          OR: [{ lastEvent: 'clicked' }, { clickCount: { gt: 0 } }],
        },
      }),
      prisma.sentEmail.count({
        where: {
          createdAt: { gte: dayAgo },
          status: { in: [...SUCCESS] },
        },
      }),
      prisma.sentEmail.count({
        where: {
          createdAt: { gte: weekAgo },
          status: { in: [...SUCCESS] },
        },
      }),
      prisma.sentEmail.findMany({
        where: { createdAt: { gte: weekAgo } },
        select: {
          toEmail: true,
          status: true,
          createdAt: true,
          subject: true,
          lastEvent: true,
          clickCount: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 20000,
      }),
    ]);

    // Daily volume last 7 days
    const byDayMap = new Map<
      string,
      { date: string; sent: number; opened: number; clicked: number; failed: number }
    >();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDayMap.set(key, { date: key, sent: 0, opened: 0, clicked: 0, failed: 0 });
    }

    const domainMap = new Map<string, number>();
    const uniqueEmails = new Set<string>();

    for (const r of recent) {
      const key = r.createdAt.toISOString().slice(0, 10);
      const bucket = byDayMap.get(key);
      const st = (r.status || '').toUpperCase();
      const wasClicked =
        (r.lastEvent || '').toLowerCase() === 'clicked' ||
        (typeof r.clickCount === 'number' && r.clickCount > 0);
      if (bucket) {
        if (st === 'FAILED') bucket.failed += 1;
        else if (SUCCESS.includes(st as any)) {
          bucket.sent += 1;
          if (st === 'OPENED') bucket.opened += 1;
          if (wasClicked) bucket.clicked += 1;
        }
      }
      const email = (r.toEmail || '').toLowerCase().trim();
      if (email.includes('@')) {
        uniqueEmails.add(email);
        const domain = email.split('@')[1] || 'unknown';
        domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
      }
    }

    // Unique contacts all-time (quick aggregate)
    let uniqueContacts = 0;
    try {
      const rows = await prisma.$queryRawUnsafe<{ c: number }[]>(
        `SELECT COUNT(DISTINCT lower(trim("toEmail")))::int AS c
         FROM "SentEmail"
         WHERE "status" IN ('SENT','DELIVERED','OPENED')`
      );
      uniqueContacts = Number(rows[0]?.c || 0);
    } catch {
      uniqueContacts = uniqueEmails.size;
    }

    const topDomains = Array.from(domainMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const openRate =
      delivered > 0 ? Math.round((opened / delivered) * 1000) / 10 : 0;
    const clickRate =
      opened > 0 ? Math.round((clicked / opened) * 1000) / 10 : 0;
    const failRate = total > 0 ? Math.round((failed / total) * 1000) / 10 : 0;

    return NextResponse.json({
      success: true,
      totals: {
        total,
        sent,
        failed,
        delivered,
        opened,
        clicked,
        today,
        last7,
        uniqueContacts,
        openRate,
        clickRate,
        failRate,
      },
      byDay: Array.from(byDayMap.values()),
      topDomains,
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load analytics' },
      { status: 500 }
    );
  }
}
