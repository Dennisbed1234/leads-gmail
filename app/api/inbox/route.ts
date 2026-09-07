import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // SENT | FAILED | all
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const take = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500);

    const where: any = {};
    if (status === 'SENT' || status === 'FAILED') {
      where.status = status;
    }
    if (q) {
      where.OR = [
        { toEmail: { contains: q, mode: 'insensitive' } },
        { toName: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total, sentCount, failedCount] = await Promise.all([
      prisma.sentEmail.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      }),
      prisma.sentEmail.count({ where }),
      prisma.sentEmail.count({ where: { status: 'SENT' } }),
      prisma.sentEmail.count({ where: { status: 'FAILED' } }),
    ]);

    return NextResponse.json({
      success: true,
      total,
      sentCount,
      failedCount,
      items,
    });
  } catch (error: any) {
    console.error('Inbox list error:', error);
    // Schema may not be pushed yet
    const msg = error?.message || 'Failed to load inbox';
    if (String(msg).includes('sentEmail') || String(msg).includes('does not exist')) {
      return NextResponse.json({
        success: true,
        total: 0,
        sentCount: 0,
        failedCount: 0,
        items: [],
        note: 'Run prisma db push so the SentEmail table exists.',
      });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
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
    return NextResponse.json(
      { error: error?.message || 'Delete failed' },
      { status: 500 }
    );
  }
}
