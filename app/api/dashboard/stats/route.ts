import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const [totalLeads, uniqueCompanies, sources, statuses, averageScore] =
      await Promise.all([
        prisma.lead.count(),

        prisma.lead.groupBy({
          by: ['company'],
          _count: {
            _all: true,
          },
        }),

        prisma.lead.groupBy({
          by: ['source'],
          _count: {
            _all: true,
          },
        }),

        prisma.lead.groupBy({
          by: ['status'],
          _count: {
            _all: true,
          },
        }),

        prisma.lead.aggregate({
          _avg: {
            score: true,
          },
        }),
      ]);

    return NextResponse.json({
      totalLeads,
      uniqueCompanies: uniqueCompanies.length,
      sources: sources.map((s) => ({
        name: s.source,
        count: s._count._all,
      })),
      statuses: statuses.map((s) => ({
        name: s.status,
        count: s._count._all,
      })),
      averageScore,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);

    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
