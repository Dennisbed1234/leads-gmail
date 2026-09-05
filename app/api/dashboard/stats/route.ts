import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const [totalLeads, uniqueCompanies, sources, statuses] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({
        by: ['company'],
        _count: true,
      }),
      prisma.lead.groupBy({
        by: ['source'],
        _count: true,
      }),
      prisma.lead.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    return NextResponse.json({
      totalLeads,
      uniqueCompanies: uniqueCompanies.length,
      sources: sources.map(s => ({ name: s.source, count: s._count })),
      statuses: statuses.map(s => ({ name: s.status, count: s._count })),
      averageScore: await prisma.lead.aggregate({
        _avg: { score: true }
      })
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}