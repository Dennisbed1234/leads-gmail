import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ensureSentEmailTable } from '@/lib/db/ensure-sent-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Unique contacts who successfully received at least one email.
 * Built from SentEmail rows with status SENT.
 */
export async function GET(request: Request) {
  try {
    await ensureSentEmailTable();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.min(
      Math.max(Number(searchParams.get('limit')) || 2000, 1),
      5000
    );

    // Pull recent successful sends, then unique by email in app code
    // (Postgres DISTINCT ON is fine too; this stays portable).
    const rows = await prisma.sentEmail.findMany({
      where: {
        status: 'SENT',
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
      take: Math.min(limit * 5, 10000),
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

    const totalSent = await prisma.sentEmail.count({ where: { status: 'SENT' } });

    return NextResponse.json({
      success: true,
      totalUnique: contacts.length,
      totalSentLogs: totalSent,
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
