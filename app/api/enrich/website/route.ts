import { NextResponse } from 'next/server';
import { extractEmailsFromDomain } from '@/lib/enrichment/website';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const domain = String(body.domain || body.url || '').trim();
    const company = String(body.company || domain).trim();
    const save = body.save !== false;

    if (!domain) {
      return NextResponse.json(
        { error: 'domain required (e.g. acme.com)' },
        { status: 400 }
      );
    }

    const hits = await extractEmailsFromDomain(domain, { maxPages: 8 });
    const saved = [];

    if (save) {
      for (const hit of hits) {
        try {
          const local = hit.email.split('@')[0];
          const lead = await prisma.lead.upsert({
            where: { email: hit.email },
            create: {
              name: local,
              title: 'Website contact',
              company,
              email: hit.email,
              source: 'Website contact page',
              score: hit.score,
              tags: JSON.stringify(['Website', hit.domain]),
              status: 'NEW',
              notes: hit.pageUrl,
            },
            update: {
              company,
              score: Math.max(hit.score, 50),
              notes: hit.pageUrl,
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
      domain,
      found: hits.length,
      saved: saved.length,
      hits,
      leads: saved,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Website enrichment failed' },
      { status: 500 }
    );
  }
}
