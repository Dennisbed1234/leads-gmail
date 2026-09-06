/**
 * Extract publicly listed emails from a company domain's common contact pages.
 * Only fetches pages on the domain you provide (no open-web crawling).
 */

export type WebsiteEmailHit = {
  email: string;
  pageUrl: string;
  domain: string;
  score: number;
};

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const SKIP_LOCAL = [
  'example',
  'email',
  'user',
  'name',
  'domain',
  'test',
  'sentry',
  'wixpress',
  'github',
  'webpack',
  'noreply',
  'no-reply',
  'donotreply',
];

const CONTACT_PATHS = [
  '/',
  '/contact',
  '/contact-us',
  '/contactus',
  '/about',
  '/about-us',
  '/team',
  '/company',
  '/support',
  '/help',
];

function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.split('/')[0];
  return d;
}

function isGoodEmail(email: string, domain: string): boolean {
  const e = email.toLowerCase();
  const [local, host] = e.split('@');
  if (!local || !host) return false;
  if (SKIP_LOCAL.some((s) => local.includes(s))) return false;
  if (host.includes('example.com')) return false;
  if (host.endsWith('.png') || host.endsWith('.jpg')) return false;
  if (host === domain || host.endsWith(`.${domain}`)) return true;
  if (['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com'].includes(host)) {
    return local.length >= 3;
  }
  return host.includes('.');
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          process.env.SEC_USER_AGENT ||
          'LeadBotPro/1.0 (contact enrichment)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('text') && !ctype.includes('html')) return null;
    const text = await res.text();
    return text.slice(0, 500_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractEmails(html: string): string[] {
  const mailtos = [
    ...html.matchAll(
      /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi
    ),
  ].map((m) => m[1].toLowerCase());
  const plain = html.match(EMAIL_RE) || [];
  return [...new Set([...mailtos, ...plain.map((e) => e.toLowerCase())])];
}

export async function extractEmailsFromDomain(
  domainOrUrl: string,
  options?: { maxPages?: number }
): Promise<WebsiteEmailHit[]> {
  const domain = normalizeDomain(domainOrUrl);
  if (!domain || !domain.includes('.')) {
    throw new Error('Valid domain required (e.g. acme.com)');
  }

  const maxPages = options?.maxPages ?? 6;
  const paths = CONTACT_PATHS.slice(0, maxPages);
  const hits: WebsiteEmailHit[] = [];
  const seen = new Set<string>();

  for (const path of paths) {
    const pageUrl = `https://${domain}${path}`;
    const html = await fetchText(pageUrl);
    if (!html) continue;

    const emails = extractEmails(html);
    for (const email of emails) {
      if (!isGoodEmail(email, domain)) continue;
      if (seen.has(email)) continue;
      seen.add(email);

      const host = email.split('@')[1];
      const sameDomain = host === domain || host.endsWith(`.${domain}`);
      hits.push({
        email,
        pageUrl,
        domain,
        score: sameDomain ? 85 : 60,
      });
    }
  }

  return hits.sort((a, b) => b.score - a.score);
}
