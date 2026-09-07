/** Extract and normalize email addresses from arbitrary text / file content. */

const EMAIL_RE =
  /[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]{0,62}[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/g;

const JUNK_LOCAL = /^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|abuse)$/i;

export type ExtractedEmail = {
  email: string;
  domain: string;
  local: string;
  isGmail: boolean;
};

function normalize(raw: string): string | null {
  let e = raw.trim().toLowerCase();
  // Strip common wrappers
  e = e.replace(/^mailto:/i, '');
  e = e.replace(/[<>\[\]()"']+/g, '');
  e = e.replace(/\s+/g, '');
  // Trailing punctuation from sentences
  e = e.replace(/[.,;:]+$/g, '');

  if (!e.includes('@')) return null;
  if (e.length > 254) return null;

  const [local, domain] = e.split('@');
  if (!local || !domain) return null;
  if (local.length > 64) return null;
  if (JUNK_LOCAL.test(local)) return null;
  if (!domain.includes('.')) return null;
  if (/\.\./.test(e)) return null;

  // Basic shape check
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(e)) return null;

  return e;
}

export function extractEmailsFromText(
  text: string,
  options?: { unique?: boolean; gmailOnly?: boolean }
): ExtractedEmail[] {
  if (!text || typeof text !== 'string') return [];

  const unique = options?.unique !== false;
  const gmailOnly = Boolean(options?.gmailOnly);

  const seen = new Set<string>();
  const out: ExtractedEmail[] = [];

  // Soften obfuscations: name [at] domain [dot] com
  const softened = text
    .replace(/\s*[\[\(]?\s*at\s*[\]\)]?\s*/gi, '@')
    .replace(/\s*[\[\(]?\s*dot\s*[\]\)]?\s*/gi, '.');

  const matches = softened.match(EMAIL_RE) || [];

  for (const m of matches) {
    const email = normalize(m);
    if (!email) continue;
    if (unique && seen.has(email)) continue;

    const [local, domain] = email.split('@');
    const isGmail =
      domain === 'gmail.com' ||
      domain === 'googlemail.com';

    if (gmailOnly && !isGmail) continue;

    seen.add(email);
    out.push({ email, domain, local, isGmail });
  }

  return out;
}

export function emailsToCsv(emails: ExtractedEmail[]): string {
  const header = 'email,domain,local,is_gmail';
  const rows = emails.map(
    (e) =>
      `${e.email},${e.domain},${e.local},${e.isGmail ? 'yes' : 'no'}`
  );
  return [header, ...rows].join('\n');
}
