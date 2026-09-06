import { NextResponse } from 'next/server';
import { searchCompanies } from '@/lib/sec/pipeline';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || searchParams.get('query') || '';

  if (q.trim().length < 1) {
    return NextResponse.json(
      { error: 'Query required' },
      { status: 400 }
    );
  }

  try {
    const companies = await searchCompanies(q, 30);
    return NextResponse.json({ query: q, total: companies.length, companies });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Search failed' },
      { status: 500 }
    );
  }
}
