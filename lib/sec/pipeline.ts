import { secClient } from './client';
import { sampleCompanies, searchTickers, TickerEntry } from './tickers';
import { EmailGenerator } from '@/lib/email/generator';
import { prisma } from '@/lib/db/prisma';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function scoreTitle(title: string): number {
  let score = 55;
  const t = title.toLowerCase();
  if (/ceo|chief executive|president/.test(t)) score += 25;
  if (/cfo|chief financial|coo|cto|cio|cmo/.test(t)) score += 18;
  if (/director|vice president|\bvp\b/.test(t)) score += 10;
  return Math.min(score, 100);
}

export type BulkOptions = {
  /** Number of companies to process */
  companyCount?: number;
  /** Start offset into SEC ticker list */
  offset?: number;
  /** Explicit CIK list (overrides sampling) */
  ciks?: string[];
  /** Filing types to try in order */
  filingTypes?: string[];
  /** Max executives per company */
  maxExecsPerCompany?: number;
  /** Save Gmail candidates */
  includeGmail?: boolean;
  /** Save corporate domain candidates */
  includeCorporate?: boolean;
  /** Delay between SEC company requests (ms) — respect rate limits */
  delayMs?: number;
};

export type BulkResult = {
  companiesProcessed: number;
  companiesFailed: number;
  executivesFound: number;
  candidatesGenerated: number;
  leadsSaved: number;
  errors: string[];
  sampleLeads: any[];
};

export async function runBulkExtract(
  options: BulkOptions = {}
): Promise<BulkResult> {
  const {
    companyCount = 50,
    offset = 0,
    ciks,
    filingTypes = ['10-K', 'DEF 14A', '10-Q'],
    maxExecsPerCompany = 15,
    includeGmail = true,
    includeCorporate = true,
    delayMs = 200,
  } = options;

  const userAgent =
    process.env.SEC_USER_AGENT || 'LeadBot Pro (admin@example.com)';

  let targets: { cik: string; title?: string; ticker?: string }[] = [];

  if (ciks?.length) {
    targets = ciks.map((c) => ({ cik: c.replace(/\D/g, '') }));
  } else {
    const sampled = await sampleCompanies(userAgent, companyCount, offset);
    targets = sampled.map((t: TickerEntry) => ({
      cik: t.cik,
      title: t.title,
      ticker: t.ticker,
    }));
  }

  const result: BulkResult = {
    companiesProcessed: 0,
    companiesFailed: 0,
    executivesFound: 0,
    candidatesGenerated: 0,
    leadsSaved: 0,
    errors: [],
    sampleLeads: [],
  };

  for (const target of targets) {
    try {
      const cleanCik = target.cik.replace(/\D/g, '');

      // Try filing types until we get executives
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
        await sleep(Math.min(delayMs, 150));
      }

      const companyName =
        target.title ||
        (await secClient.getCompany(cleanCik))?.name ||
        `CIK ${cleanCik}`;

      const domain = EmailGenerator.guessDomain(
        companyName,
        target.ticker
      );

      result.executivesFound += executives.length;
      result.companiesProcessed += 1;

      const slice = executives.slice(0, maxExecsPerCompany);

      for (const exec of slice) {
        const candidates = EmailGenerator.generate(exec.name, {
          domain,
          includeGmail,
        }).filter((c) => {
          if (c.type === 'corporate' && !includeCorporate) return false;
          if (c.type === 'gmail' && !includeGmail) return false;
          return true;
        });

        // Take top 2 patterns per person to balance volume vs quality
        const top = candidates.slice(0, 2);
        result.candidatesGenerated += top.length;

        for (const cand of top) {
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
                score: scoreTitle(exec.title),
                tags: JSON.stringify([
                  'Executive',
                  cand.type,
                  cand.pattern,
                  usedFiling,
                ]),
                status: 'NEW',
                industry: target.ticker || undefined,
              },
              update: {
                name: exec.name,
                title: exec.title,
                company: companyName,
                score: scoreTitle(exec.title),
                updatedAt: new Date(),
              },
            });

            result.leadsSaved += 1;
            if (result.sampleLeads.length < 25) {
              result.sampleLeads.push(lead);
            }
          } catch (e: any) {
            // unique race or db issue — skip
            if (!String(e?.message || '').includes('Unique')) {
              // ignore
            }
          }
        }
      }
    } catch (err: any) {
      result.companiesFailed += 1;
      result.errors.push(
        `${target.cik}: ${err?.message || 'unknown error'}`
      );
    }

    // SEC fair-access: keep requests gentle
    await sleep(delayMs);
  }

  return result;
}

export async function searchCompanies(query: string, limit = 20) {
  const userAgent =
    process.env.SEC_USER_AGENT || 'LeadBot Pro (admin@example.com)';
  return searchTickers(userAgent, query, limit);
}
