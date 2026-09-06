import { NextResponse } from 'next/server';
import { secClient } from '@/lib/sec/client';
import { GmailGenerator } from '@/lib/gmail/generator';
import { BatchVerifier } from '@/lib/gmail/batch-verifier';
import { prisma } from '@/lib/db/prisma';

interface Executive {
  name: string;
  title: string;
  company?: string;
}

function calculateScore(exec: Executive): number {
  let score = 50;

  const title = exec.title.toLowerCase();

  if (
    title.includes('ceo') ||
    title.includes('chief executive') ||
    title.includes('president')
  ) {
    score += 20;
  }

  if (
    title.includes('cfo') ||
    title.includes('chief financial') ||
    title.includes('coo') ||
    title.includes('chief operating') ||
    title.includes('cto') ||
    title.includes('chief technology') ||
    title.includes('cio') ||
    title.includes('chief information') ||
    title.includes('cmo') ||
    title.includes('chief marketing')
  ) {
    score += 15;
  }

  if (
    title.includes('director') ||
    title.includes('vice president') ||
    title.includes('vp')
  ) {
    score += 10;
  }

  return Math.min(score, 100);
}

export async function POST(request: Request) {
  try {
    const {
      cik,
      filingType = '10-K',
      generateCount = 10,
    } = await request.json();

    if (!cik) {
      return NextResponse.json(
        { error: 'CIK is required' },
        { status: 400 }
      );
    }

    // Fetch company info early so we have a real name
    const companyInfo = await secClient.getCompany(cik);
    const companyName =
      companyInfo?.name?.trim() || `Company CIK ${cik}`;

    const executives = await secClient.extractExecutives(
      cik,
      filingType
    );

    if (executives.length === 0) {
      return NextResponse.json(
        {
          error: `No executives found in ${filingType} filings for CIK ${cik}. Try a different filing type or CIK.`,
        },
        { status: 404 }
      );
    }

    // Attach company name to executives
    const enrichedExecs = executives.map((e) => ({
      ...e,
      company: companyName,
    }));

    const allGmails: {
      name: string;
      title: string;
      emails: string[];
    }[] = [];

    for (const exec of enrichedExecs.slice(0, generateCount)) {
      const emails = GmailGenerator.getMostLikelyGmails(exec.name);

      allGmails.push({
        name: exec.name,
        title: exec.title,
        emails: emails.slice(0, 10),
      });
    }

    const allEmails = allGmails.flatMap((e) => e.emails);

    const verifier = new BatchVerifier();

    const verificationResults = await verifier.verifyBatch(allEmails);

    const validGmails = BatchVerifier.getHighConfidenceEmails(
      verificationResults.results
    );

    const savedLeads = [];

    for (const exec of enrichedExecs.slice(0, generateCount)) {
      const execGmails = GmailGenerator.generateGmails(exec.name);

      // Pick the highest quality valid email for this exec
      const candidateEmails = validGmails.filter((g) =>
        execGmails.includes(g)
      );

      // Prefer cleaner patterns
      const preferred =
        candidateEmails.find((e) => e.includes('.')) ||
        candidateEmails[0];

      if (preferred) {
        try {
          const lead = await prisma.lead.create({
            data: {
              name: exec.name,
              title: exec.title,
              company: companyName,
              email: preferred,
              source: 'SEC EDGAR + Gmail Verification',
              cik: cik.replace(/\D/g, ''),
              filingType: filingType,
              score: calculateScore(exec),
              tags: JSON.stringify([
                'Executive',
                'C-Suite',
                'Gmail',
                'Verified',
              ]),
              status: 'NEW',
            },
          });

          savedLeads.push(lead);
        } catch (dbError: any) {
          // Skip duplicates or other DB errors without failing the whole request
          console.warn(
            `Could not save lead for ${exec.name}:`,
            dbError?.message || dbError
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      company: companyName,
      totalExtracted: executives.length,
      gmailsGenerated: allEmails.length,
      gmailsVerified: verificationResults.totalVerified,
      validGmails: validGmails.length,
      savedLeads: savedLeads.length,
      leads: savedLeads,
      verificationStats: {
        validityRate: verificationResults.validityRate,
        totalChecked: verificationResults.totalVerified,
        totalValid: verificationResults.totalValid,
      },
    });
  } catch (error: any) {
    console.error('Error extracting leads:', error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Failed to extract leads. Check server logs and that DATABASE_URL + SEC_USER_AGENT are set.',
      },
      { status: 500 }
    );
  }
}
