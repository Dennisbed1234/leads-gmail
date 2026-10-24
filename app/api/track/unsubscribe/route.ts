import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ensureSentEmailTable } from '@/lib/db/ensure-sent-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function markUnsubscribed(id: string) {
  if (!id) return false;
  await ensureSentEmailTable();
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "SentEmail" SET
        "status" = 'UNSUBSCRIBED',
        "unsubscribedAt" = COALESCE("unsubscribedAt", CURRENT_TIMESTAMP),
        "lastEvent" = 'unsubscribed'
       WHERE "id" = $1`,
      id
    );
    return true;
  } catch (e) {
    console.error('[track/unsubscribe]', e);
    return false;
  }
}

function okPage() {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Unsubscribed</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#0a0c0a;color:#e8ebe6;display:flex;min-height:100vh;align-items:center;justify-content:center;">
  <div style="max-width:420px;padding:32px;text-align:center;">
    <h1 style="font-size:22px;margin:0 0 12px;">You’re unsubscribed</h1>
    <p style="margin:0;color:#9ca3af;line-height:1.5;font-size:15px;">You won’t receive further marketing emails from this sender on this address.</p>
  </div>
</body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** One-click List-Unsubscribe (RFC 8058) */
export async function POST(request: NextRequest) {
  const id =
    request.nextUrl.searchParams.get('id') ||
    (await request.formData().catch(() => null))?.get('id')?.toString() ||
    '';
  await markUnsubscribed(String(id).trim());
  return new NextResponse(null, { status: 204 });
}

/** Browser click from email footer */
export async function GET(request: NextRequest) {
  const id = (request.nextUrl.searchParams.get('id') || '').trim();
  await markUnsubscribed(id);
  return okPage();
}
