import { NextResponse } from 'next/server';
import { enrichFromGitHub } from '@/lib/enrichment/github';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = String(body.query || '').trim();
    const save = body.save !== false;
    const maxUsers = Math.min(Number(body.maxUsers) || 8, 15);

    if (query.length < 2) {
      return NextResponse.json(
        { error: 'query required (name, company, or GitHub username)' },
        { status: 400 }
      );
    }

    const hits = await enrichFromGitHub(query, { maxUsers });
    const saved = [];

    if (save) {
      for (const hit of hits) {
        try {
          const lead = await prisma.lead.upsert({
            where: { email: hit.email },
            create: {
              name: hit.name || hit.username,
              title: 'GitHub profile',
              company: query,
              email: hit.email,
              source: `GitHub ${hit.source}`,
              score: hit.score,
              tags: JSON.stringify(['GitHub', hit.source, hit.username]),
              status: 'NEW',
              notes: hit.profileUrl,
            },
            update: {
              score: Math.max(hit.score, 50),
              notes: hit.profileUrl,
            },
          });
          saved.push(lead);
        } catch {
          // skip
        }
      }
    }

    return NextResponse.json({
      success: true,
      query,
      found: hits.length,
      saved: saved.length,
      hits,
      leads: saved,
      tip: process.env.GITHUB_TOKEN
        ? undefined
        : 'Set GITHUB_TOKEN on Vercel for higher GitHub API rate limits.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'GitHub enrichment failed' },
      { status: 500 }
    );
  }
}
