import { NextResponse } from 'next/server';
import { secClient } from '@/lib/sec/client';
import { GmailGenerator } from '@/lib/gmail/generator';
import { GmailVerifier } from '@/lib/gmail/verifier';
import { BatchVerifier } from '@/lib/gmail/batch-verifier';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: Request) {
  try {
    const { cik, filingType = '10-K', generateCount = 10 } = await request.json();

    // 1. Get executives from SEC
    const executives = await secClient.extractExecutives(cik, filingType);
    
    if (executives.length === 0) {
      return NextResponse.json(
        { error: 'No executives found in filings' },
        { status: 404 }
      );
    }

    // 2. Generate Gmail addresses for each executive
    const allGmails: { name: string; title: string; emails: string[] }[] = [];
    
    for (const exec of executives.slice(0, generateCount)) {
      const emails = GmailGenerator.getMostLikelyGmails(exec.name);
      allGmails.push({
        name: exec.name,
        title: exec.title,
        emails: emails.slice(0, 10) // Top 10 most likely
      });
    }

    // 3. Verify all generated emails
    const allEmails = allGmails.flatMap(e => e.emails);
    const verifier = new BatchVerifier();
    const verificationResults = await verifier.verifyBatch(allEmails);

    // 4. Filter to only valid Gmail addresses
    const validGmails = BatchVerifier.getHighConfidenceEmails(verificationResults.results);

    // 5. Save to database
    const savedLeads = [];
    
    for (const exec of executives.slice(0, generateCount)) {
      // Find valid Gmail for this executive
      const execGmails = GmailGenerator.generateGmails(exec.name);
      const validEmail = validGmails.find(g => 
        execGmails.includes(g)
      );

      if (validEmail) {
        const lead = await prisma.lead.create({
          data: {
            name: exec.name,
            title: exec.title,
            company: exec.company || 'Unknown',
            email: validEmail,
            source: 'SEC EDGAR + Gmail Verification',
            cik: cik,
            filingType: filingType,
            score: this.calculateScore(exec),
            tags: ['Executive', 'C-Suite', 'Gmail', 'Verified'],
            status: 'NEW'
          }
        });
        savedLeads.push(lead);
      }
    }

    return NextResponse.json({
      success: true,
      company: executives[0]?.company || 'Unknown',
      totalExtracted: executives.length,
      gmailsGenerated: allEmails.length,
      gmailsVerified: verificationResults.totalVerified,
      validGmails: validGmails.length,
      savedLeads: savedLeads.length,
      leads: savedLeads,
      verificationStats: {
        validityRate: verificationResults.validityRate,
        totalChecked: verificationResults.totalVerified,
        totalValid: verificationResults.totalValid
      }
    });

  } catch (error) {
    console.error('Error extracting leads:', error);
    return NextResponse.json(
      { error: 'Failed to extract leads' },
      { status: 500 }
    );
  }
}