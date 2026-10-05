import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ensureSentEmailTable } from '@/lib/db/ensure-sent-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SUCCESS_STATUSES = ['SENT', 'DELIVERED', 'OPENED'] as const;

/**
 * Unique contacts who successfully received at least one email.
 * Built from SentEmail rows (SENT / DELIVERED / OPENED — never FAILED).
 * One row per email address (lowercased), no duplicates.
 */
export async function GET(request: Request) {
  try {
    await ensureSentEmailTable();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.min(
      Math.max(Number(searchParams.get('limit')) || 5000, 1),
      10000
    );

    // Prefer SQL aggregation so we never miss contacts when one person was emailed many times
    try {
      const rows = q
        ? await prisma.$queryRawUnsafe<
            {
              email: string;
              name: string | null;
              send_count: number;
              last_sent_at: Date;
              last_subject: string | null;
            }[]
          >(
            `SELECT
               lower(trim("toEmail")) AS email,
               MAX("toName") FILTER (WHERE "toName" IS NOT NULL AND "toName" <> '') AS name,
               COUNT(*)::int AS send_count,
               MAX("createdAt") AS last_sent_at,
               (
                 SELECT s2."subject" FROM "SentEmail" s2
                 WHERE lower(trim(s2."toEmail")) = lower(trim(s."toEmail"))
                   AND s2."status" IN ('SENT', 'DELIVERED', 'OPENED')
                 ORDER BY s2."createdAt" DESC
                 LIMIT 1
               ) AS last_subject
             FROM "SentEmail" s
             WHERE s."status" IN ('SENT', 'DELIVERED', 'OPENED')
               AND (
                 lower(s."toEmail") LIKE $1
                 OR lower(COALESCE(s."toName", '')) LIKE $1
               )
             GROUP BY lower(trim("toEmail"))
             ORDER BY last_sent_at DESC
             LIMIT $2`,
            `%${q}%`,
            limit
          )
        : await prisma.$queryRawUnsafe<
            {
              email: string;
              name: string | null;
              send_count: number;
              last_sent_at: Date;
              last_subject: string | null;
            }[]
          >(
            `SELECT
               lower(trim("toEmail")) AS email,
               MAX("toName") FILTER (WHERE "toName" IS NOT NULL AND "toName" <> '') AS name,
               COUNT(*)::int AS send_count,
               MAX("createdAt") AS last_sent_at,
               (
                 SELECT s2."subject" FROM "SentEmail" s2
                 WHERE lower(trim(s2."toEmail")) = lower(trim(s."toEmail"))
                   AND s2."status" IN ('SENT', 'DELIVERED', 'OPENED')
                 ORDER BY s2."createdAt" DESC
                 LIMIT 1
               ) AS last_subject
             FROM "SentEmail" s
             WHERE s."status" IN ('SENT', 'DELIVERED', 'OPENED')
             GROUP BY lower(trim("toEmail"))
             ORDER BY last_sent_at DESC
             LIMIT $1`,
            limit
          );

      const contacts = rows
        .filter((r) => r.email && r.email.includes('@'))
        .map((r) => ({
          email: r.email,
          name: r.name || null,
          sendCount: Number(r.send_count) || 1,
          lastSentAt:
            r.last_sent_at instanceof Date
              ? r.last_sent_at.toISOString()
              : String(r.last_sent_at),
          lastSubject: r.last_subject || '',
        }));

      // Deduplicate again defensively (should already be unique)
      const seen = new Set<string>();
      const unique = contacts.filter((c) => {
        if (seen.has(c.email)) return false;
        seen.add(c.email);
        return true;
      });

      const totalSentLogs = await prisma.sentEmail.count({
        where: { status: { in: [...SUCCESS_STATUSES] } },
      });

      return NextResponse.json({
        success: true,
        totalUnique: unique.length,
        totalSentLogs,
        contacts: unique,
      });
    } catch (sqlErr) {
      console.warn('contacts SQL aggregate failed, fallback', sqlErr);
    }

    // Fallback: Prisma findMany + Map dedupe
    const rows = await prisma.sentEmail.findMany({
      where: {
        status: { in: [...SUCCESS_STATUSES] },
        ...(q
          ? {
              OR: [
                { toEmail: { contains: q, mode: 'insensitive' as const } },
                { toName: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20000,
      select: {
        toEmail: true,
        toName: true,
        subject: true,
        createdAt: true,
      },
    });

    const map = new Map<
      string,
      {
        email: string;
        name: string | null;
        sendCount: number;
        lastSentAt: string;
        lastSubject: string;
      }
    >();

    for (const r of rows) {
      const email = r.toEmail.toLowerCase().trim();
      if (!email.includes('@')) continue;
      const existing = map.get(email);
      if (!existing) {
        map.set(email, {
          email,
          name: r.toName || null,
          sendCount: 1,
          lastSentAt: r.createdAt.toISOString(),
          lastSubject: r.subject,
        });
      } else {
        existing.sendCount += 1;
        if (!existing.name && r.toName) existing.name = r.toName;
      }
    }

    let contacts = Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.lastSentAt).getTime() - new Date(a.lastSentAt).getTime()
    );

    if (contacts.length > limit) {
      contacts = contacts.slice(0, limit);
    }

    const totalSentLogs = await prisma.sentEmail.count({
      where: { status: { in: [...SUCCESS_STATUSES] } },
    });

    return NextResponse.json({
      success: true,
      totalUnique: contacts.length,
      totalSentLogs,
      contacts,
    });
  } catch (error: any) {
    console.error('Contacts list error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load contacts', contacts: [] },
      { status: 500 }
    );
  }
}
