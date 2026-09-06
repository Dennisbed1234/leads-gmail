import { NextResponse } from 'next/server';
import { secClient } from '@/lib/sec/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Query parameter required (minimum 2 characters)' },
      { status: 400 }
    );
  }

  try {
    // For now, search by CIK only
    const company = await secClient.getCompany(query);
    
    if (!company) {
      return NextResponse.json({
        query,
        total: 0,
        companies: []
      });
    }

    return NextResponse.json({
      query,
      total: 1,
      companies: [company]
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to search companies' },
      { status: 500 }
    );
  }
}