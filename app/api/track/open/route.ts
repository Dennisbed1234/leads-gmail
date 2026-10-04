import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ensureSentEmailTable } from '@/lib/db/ensure-sent-email';
import { TRANSPARENT_GIF } from '@/lib/tracking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function gif() {
  return new NextResponse(new Uint8Array(TRANSPARENT_GIF), {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRANSPARENT_GIF.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function markOpened(id: string) {
  await ensureSentEmailTable();
  try {
    // Prefer columns with open tracking
    await prisma.$executeRawUnsafe(
      `UPDATE "SentEmail" SET
        "status" = CASE WHEN "status" = 'FAILED' THEN "status" ELSE 'OPENED' END,
        "openedAt" = COALESCE("openedAt", CURRENT_TIMESTAMP),
        "openCount" = COALESCE("openCount", 0) + 1,
        "lastEvent" = 'opened'
       WHERE "id" = $1`,
      id
    );
  } catch {
    // Fallback without extra columns
    try {
      await prisma.sentEmail.update({
        where: { id },
        data: { status: 'OPENED' },
      });
    } catch (e) {
      console.error('[track/open] update failed', id, e);
    }
  }
}

export async function GET(request: NextRequest) {
  const id = (request.nextUrl.searchParams.get('id') || '').trim();
  if (id) {
    try {
      await markOpened(id);
      console.log('[track/open]', id);
    } catch (e) {
      console.error('[track/open]', e);
    }
  }
  return gif();
}

export async function HEAD(request: NextRequest) {
  const id = (request.nextUrl.searchParams.get('id') || '').trim();
  if (id) {
    try {
      await markOpened(id);
    } catch {
      /* ignore */
    }
  }
  return new NextResponse(null, {
    status: 200,
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
  });
}
