import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

type SourceGroup = {
  source: string;
  _count: {
    _all: number;
  };
};

type StatusGroup = {
  status: string;
  _count: {
    _all: number;
  };
};

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

    const typedSources = sources as SourceGroup[];
    const typedStatuses = statuses as StatusGroup[];

    return NextResponse.json({
      totalLeads,
      uniqueCompanies: uniqueCompanies.length,

      sources: typedSources.map((s: SourceGroup) => ({
        name: s.source,
        count: s._count._all,
      })),

      statuses: typedStatuses.map((s: StatusGroup) => ({
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
