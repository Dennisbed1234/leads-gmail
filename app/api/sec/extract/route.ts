import { NextResponse } from 'next/server';
import { secClient } from '@/lib/sec/client';
import { EmailGenerator } from '@/lib/email/generator';
import { prisma } from '@/lib/db/prisma';

function calculateScore(title: string): number {
  let score = 55;
  const t = title.toLowerCase();
  if (/ceo|chief executive|president/.test(t)) score += 25;
  if (/cfo|chief financial|coo|cto|cio|cmo/.test(t)) score += 18;
  if (/director|vice president|\bvp\b/.test(t)) score += 10;
  return Math.min(score, 100);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cik = body.cik;
    const filingTypes: string[] = body.filingTypes || [
      body.filingType || '10-K',
      'DEF 14A',
      '10-Q',
    ];
    const generateCount = Math.min(Number(body.generateCount) || 20, 50);

    if (!cik) {
      return NextResponse.json({ error: 'CIK is required' }, { status: 400 });
    }

    const cleanCik = String(cik).replace(/\D/g, '');
    const companyInfo = await secClient.getCompany(cleanCik);
    const companyName =
      companyInfo?.name?.trim() || `Company CIK ${cleanCik}`;
    const domain = EmailGenerator.guessDomain(
      companyName,
      companyInfo?.ticker
    );

    let executives: Awaited<
      ReturnType<typeof secClient.extractExecutives>
    > = [];
    let usedFiling = filingTypes[0];

    for (const ft of filingTypes) {
      executives = await secClient.extractExecutives(cleanCik, ft);
      if (executives.length > 0) {
        usedFiling = ft;
        break;
      }
    }

    if (executives.length === 0) {
      return NextResponse.json(
        {
          error: `No executives found for CIK ${cleanCik}. Tried: ${filingTypes.join(', ')}`,
        },
        { status: 404 }
      );
    }

    const slice = executives.slice(0, generateCount);
    let candidatesGenerated = 0;
    const savedLeads = [];

    for (const exec of slice) {
      const candidates = EmailGenerator.generate(exec.name, {
        domain,
        includeGmail: true,
      }).slice(0, 3);

      candidatesGenerated += candidates.length;

      for (const cand of candidates) {
        try {
          const lead = await prisma.lead.upsert({
            where: { email: cand.email },
            create: {
              name: exec.name,
              title: exec.title,
              company: companyName,
              email: cand.email,
              source: `SEC ${usedFiling} + ${cand.type}`,
              cik: cleanCik,
              filingType: usedFiling,
              score: calculateScore(exec.title),
              tags: JSON.stringify([
                'Executive',
                cand.type,
                cand.pattern,
                usedFiling,
              ]),
              status: 'NEW',
            },
            update: {
              name: exec.name,
              title: exec.title,
              company: companyName,
              score: calculateScore(exec.title),
            },
          });
          savedLeads.push(lead);
        } catch {
          // skip duplicate races
        }
      }
    }

    // Dedupe sample by email for response
    const uniqueByEmail = Array.from(
      new Map(savedLeads.map((l) => [l.email, l])).values()
    );

    return NextResponse.json({
      success: true,
      company: companyName,
      filingUsed: usedFiling,
      domainGuess: domain || null,
      totalExtracted: executives.length,
      gmailsGenerated: candidatesGenerated,
      validGmails: uniqueByEmail.length,
      savedLeads: uniqueByEmail.length,
      leads: uniqueByEmail,
      note:
        'Candidates are pattern-based from public SEC names. Corporate patterns use guessed domain. For true mailbox verification use Hunter/ZeroBounce.',
    });
  } catch (error: any) {
    console.error('Error extracting leads:', error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Failed to extract leads. Check DATABASE_URL + SEC_USER_AGENT.',
      },
      { status: 500 }
    );
  }
}
