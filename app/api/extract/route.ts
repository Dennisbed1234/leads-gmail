import { NextResponse } from 'next/server';
import { secClient } from '@/lib/sec/client';
import { GmailGenerator } from '@/lib/gmail/generator';
import { BatchVerifier } from '@/lib/gmail/batch-verifier';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: Request) {
  try {
    const {
      cik,
      filingType = '10-K',
      generateCount = 10,
    } = await request.json();

    if (!cik) {
      return NextResponse.json(
        { error: 'CIK required' },
        { status: 400 }
      );
    }

    // 1. Get company info
    const company = await secClient.getCompany(cik);
    const companyName = company?.name || `Company_${cik}`;

    // 2. Get executives from SEC
    const executives = await secClient.extractExecutives(
      cik,
      filingType
    );

    if (executives.length === 0) {
      return NextResponse.json(
        { error: 'No executives found in filings' },
        { status: 404 }
      );
    }

    // 3. Generate Gmail addresses
    const allGmails: {
      name: string;
      title: string;
      emails: string[];
    }[] = [];

    for (const exec of executives.slice(0, generateCount)) {
      const emails = GmailGenerator.getMostLikelyGmails(
        exec.name
      );

      allGmails.push({
        name: exec.name,
        title: exec.title,
        emails: emails.slice(0, 10),
      });
    }

    // 4. Verify all generated emails
    const allEmails = allGmails.flatMap(
      (e) => e.emails
    );

    const verifier = new BatchVerifier();

    const verificationResults =
      await verifier.verifyBatch(allEmails);

    // 5. Filter to only valid Gmail addresses
    const validGmails =
      BatchVerifier.getHighConfidenceEmails(
        verificationResults.results
      );

    // 6. Save to database
    const savedLeads = [];

    for (const exec of executives.slice(0, generateCount)) {
      const execGmails =
        GmailGenerator.generateGmails(exec.name);

      const validEmail = validGmails.find((g) =>
        execGmails.includes(g)
      );

      if (validEmail) {
        try {
          const lead = await prisma.lead.create({
            data: {
              name: exec.name,
              title: exec.title,
              company: companyName,
              email: validEmail,
              source: 'SEC EDGAR + Gmail',
              cik: cik.replace(/\D/g, ''),
              filingType: filingType,
              score: 70 + Math.floor(Math.random() * 20),
              tags: JSON.stringify([
                'Executive',
                'C-Suite',
                'Verified Gmail',
              ]),
              status: 'NEW',
            },
          });

          savedLeads.push(lead);
        } catch (dbError: any) {
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
      cik,
      totalExtracted: executives.length,
      gmailsGenerated: allEmails.length,
      gmailsVerified: verificationResults.totalVerified,
      validGmails: validGmails.length,
      savedLeads: savedLeads.length,
      leads: savedLeads,
      verificationStats: {
        validityRate:
          verificationResults.validityRate,
        totalChecked:
          verificationResults.totalVerified,
        totalValid:
          verificationResults.totalValid,
      },
    });
  } catch (error: any) {
    console.error(
      'Error extracting leads:',
      error
    );

    return NextResponse.json(
      { error: error?.message || 'Failed to extract leads' },
      { status: 500 }
    );
  }
}
