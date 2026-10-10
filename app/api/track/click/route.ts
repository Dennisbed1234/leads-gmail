import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ensureSentEmailTable } from '@/lib/db/ensure-sent-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function markClicked(id: string) {
  await ensureSentEmailTable();
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "SentEmail" SET
        "status" = CASE WHEN "status" = 'FAILED' THEN "status" ELSE 'OPENED' END,
        "openedAt" = COALESCE("openedAt", CURRENT_TIMESTAMP),
        "openCount" = COALESCE("openCount", 0) + 1,
        "clickCount" = COALESCE("clickCount", 0) + 1,
        "lastEvent" = 'clicked'
       WHERE "id" = $1`,
      id
    );
  } catch {
    try {
      await prisma.sentEmail.update({
        where: { id },
        data: { status: 'OPENED' },
      });
    } catch (e) {
      console.error('[track/click]', e);
    }
  }
}

export async function GET(request: NextRequest) {
  const id = (request.nextUrl.searchParams.get('id') || '').trim();
  const u = request.nextUrl.searchParams.get('u') || '';

  let target = 'https://www.google.com';
  try {
    const parsed = new URL(u);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      target = parsed.toString();
    }
  } catch {
    /* keep default */
  }

  if (id) {
    try {
      await markClicked(id);
      console.log('[track/click]', id, target);
    } catch (e) {
      console.error('[track/click]', e);
    }
  }

  return NextResponse.redirect(target, 302);
}
