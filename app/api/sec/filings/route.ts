import { NextResponse } from 'next/server';
import { secClient } from '@/lib/sec/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cik = searchParams.get('cik');
  const filingType = searchParams.get('type') || '10-K';
  const limit = parseInt(searchParams.get('limit') || '5');

  if (!cik) {
    return NextResponse.json(
      { error: 'CIK parameter required' },
      { status: 400 }
    );
  }

  try {
    const filings = await secClient.getFilings(cik, limit);
    const filtered = filings.filter(f => f.type === filingType);
    const executives = await secClient.extractExecutives(cik, filingType);

    return NextResponse.json({
      cik,
      filingType,
      totalFilings: filings.length,
      filings: filtered,
      executives: executives.slice(0, 10)
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch filings' },
      { status: 500 }
    );
  }
}