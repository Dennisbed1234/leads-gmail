import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ensureSentEmailTable } from '@/lib/db/ensure-sent-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACCEPTED = ['SENT', 'DELIVERED', 'OPENED'] as const;

export async function GET(request: NextRequest) {
  try {
    await ensureSentEmailTable();

    const campaignId = (
      request.nextUrl.searchParams.get('campaignId') ||
      request.nextUrl.searchParams.get('campaign') ||
      ''
    ).trim();

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const campFilter = campaignId
      ? `AND "campaignId" = '${campaignId.replace(/'/g, "''")}'`
      : '';

    const countWhere = (extra: string) =>
      prisma.$queryRawUnsafe<{ c: number }[]>(
        `SELECT COUNT(*)::int AS c FROM "SentEmail" WHERE 1=1 ${campFilter} ${extra}`
      );

    const [
      totalR,
      acceptedR,
      failedR,
      bouncedR,
      openedR,
      clickedR,
      unsubR,
      todayR,
      last7R,
    ] = await Promise.all([
      countWhere(''),
      countWhere(`AND upper("status") IN ('SENT','DELIVERED','OPENED')`),
      countWhere(`AND upper("status") = 'FAILED'`),
      countWhere(
        `AND (upper("status") = 'BOUNCED' OR lower(COALESCE("bounceType",'')) = 'hard')`
      ),
      countWhere(
        `AND (upper("status") = 'OPENED' OR "openedAt" IS NOT NULL OR COALESCE("openCount",0) > 0)`
      ),
      countWhere(
        `AND (lower(COALESCE("lastEvent",'')) = 'clicked' OR COALESCE("clickCount",0) > 0)`
      ),
      countWhere(
        `AND (upper("status") = 'UNSUBSCRIBED' OR "unsubscribedAt" IS NOT NULL)`
      ),
      countWhere(
        `AND "createdAt" >= $1 AND upper("status") IN ('SENT','DELIVERED','OPENED')`
      ).catch(() => [{ c: 0 }]),
      countWhere(
        `AND "createdAt" >= $1 AND upper("status") IN ('SENT','DELIVERED','OPENED')`
      ).catch(() => [{ c: 0 }]),
    ]);

    // today / last7 with proper params
    let today = 0;
    let last7 = 0;
    try {
      const t = await prisma.$queryRawUnsafe<{ c: number }[]>(
        `SELECT COUNT(*)::int AS c FROM "SentEmail"
         WHERE "createdAt" >= $1
           AND upper("status") IN ('SENT','DELIVERED','OPENED')
           ${campFilter}`,
        dayAgo
      );
      today = Number(t[0]?.c || 0);
      const w = await prisma.$queryRawUnsafe<{ c: number }[]>(
        `SELECT COUNT(*)::int AS c FROM "SentEmail"
         WHERE "createdAt" >= $1
           AND upper("status") IN ('SENT','DELIVERED','OPENED')
           ${campFilter}`,
        weekAgo
      );
      last7 = Number(w[0]?.c || 0);
    } catch {
      today = Number(todayR[0]?.c || 0);
      last7 = Number(last7R[0]?.c || 0);
    }

    const total = Number(totalR[0]?.c || 0);
    const smtpAccepted = Number(acceptedR[0]?.c || 0);
    const failed = Number(failedR[0]?.c || 0);
    const bounced = Number(bouncedR[0]?.c || 0);
    const opened = Number(openedR[0]?.c || 0);
    const clicked = Number(clickedR[0]?.c || 0);
    const unsubscribed = Number(unsubR[0]?.c || 0);

    const recent = await prisma.sentEmail.findMany({
      where: {
        createdAt: { gte: weekAgo },
        ...(campaignId ? ({ campaignId } as any) : {}),
      },
      select: {
        toEmail: true,
        status: true,
        createdAt: true,
        subject: true,
        lastEvent: true,
        clickCount: true,
        openCount: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 20000,
    });

    const byDayMap = new Map<
      string,
      {
        date: string;
        sent: number;
        opened: number;
        clicked: number;
        failed: number;
        bounced: number;
        unsubscribed: number;
      }
    >();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDayMap.set(key, {
        date: key,
        sent: 0,
        opened: 0,
        clicked: 0,
        failed: 0,
        bounced: 0,
        unsubscribed: 0,
      });
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
      const wasOpened =
        st === 'OPENED' ||
        (typeof r.openCount === 'number' && r.openCount > 0) ||
        (r.lastEvent || '').toLowerCase() === 'opened' ||
        wasClicked;

      if (bucket) {
        if (st === 'FAILED') bucket.failed += 1;
        else if (st === 'BOUNCED') bucket.bounced += 1;
        else if (st === 'UNSUBSCRIBED') bucket.unsubscribed += 1;
        else if (ACCEPTED.includes(st as any)) {
          bucket.sent += 1;
          if (wasOpened) bucket.opened += 1;
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

    let uniqueContacts = 0;
    try {
      const rows = await prisma.$queryRawUnsafe<{ c: number }[]>(
        `SELECT COUNT(DISTINCT lower(trim("toEmail")))::int AS c
         FROM "SentEmail"
         WHERE upper("status") IN ('SENT','DELIVERED','OPENED')
         ${campFilter}`
      );
      uniqueContacts = Number(rows[0]?.c || 0);
    } catch {
      uniqueContacts = uniqueEmails.size;
    }

    // Distinct campaigns (recent)
    let campaigns: { id: string; count: number }[] = [];
    try {
      const rows = await prisma.$queryRawUnsafe<
        { id: string; count: number }[]
      >(
        `SELECT "campaignId" AS id, COUNT(*)::int AS count
         FROM "SentEmail"
         WHERE "campaignId" IS NOT NULL AND trim("campaignId") <> ''
         GROUP BY "campaignId"
         ORDER BY MAX("createdAt") DESC
         LIMIT 30`
      );
      campaigns = rows;
    } catch {
      campaigns = [];
    }

    const topDomains = Array.from(domainMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const openRate =
      smtpAccepted > 0
        ? Math.round((opened / smtpAccepted) * 1000) / 10
        : 0;
    const clickRate =
      opened > 0 ? Math.round((clicked / opened) * 1000) / 10 : 0;
    const failRate =
      total > 0 ? Math.round(((failed + bounced) / total) * 1000) / 10 : 0;
    const unsubRate =
      smtpAccepted > 0
        ? Math.round((unsubscribed / smtpAccepted) * 1000) / 10
        : 0;

    return NextResponse.json({
      success: true,
      campaignId: campaignId || null,
      totals: {
        total,
        /** SMTP accepted the message — not proof of inbox placement */
        smtpAccepted,
        sent: smtpAccepted,
        failed,
        bounced,
        delivered: smtpAccepted,
        opened,
        clicked,
        unsubscribed,
        today,
        last7,
        uniqueContacts,
        openRate,
        clickRate,
        failRate,
        unsubRate,
      },
      byDay: Array.from(byDayMap.values()),
      topDomains,
      campaigns,
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load analytics' },
      { status: 500 }
    );
  }
}
