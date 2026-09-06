import { NextResponse } from 'next/server';
import { runBulkExtract } from '@/lib/sec/pipeline';

export const maxDuration = 60; // Vercel pro/hobby limit awareness
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const companyCount = Math.min(
      Math.max(Number(body.companyCount) || 25, 1),
      100 // hard cap per request to stay within serverless time
    );

    const offset = Math.max(Number(body.offset) || 0, 0);
    const ciks = Array.isArray(body.ciks) ? body.ciks.slice(0, 100) : undefined;

    const result = await runBulkExtract({
      companyCount,
      offset,
      ciks,
      maxExecsPerCompany: Math.min(Number(body.maxExecsPerCompany) || 12, 25),
      includeGmail: body.includeGmail !== false,
      includeCorporate: body.includeCorporate !== false,
      delayMs: Math.min(Math.max(Number(body.delayMs) || 250, 100), 1000),
      filingTypes: body.filingTypes || ['10-K', 'DEF 14A', '10-Q'],
    });

    return NextResponse.json({
      success: true,
      ...result,
      tip:
        'Run multiple batches with increasing offset (0, 100, 200…) throughout the day to reach 1k–5k leads. True mailbox verification still requires a paid API (Hunter, ZeroBounce).',
    });
  } catch (error: any) {
    console.error('Bulk extract failed:', error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Bulk extract failed. Ensure DATABASE_URL and SEC_USER_AGENT are set.',
      },
      { status: 500 }
    );
  }
}
