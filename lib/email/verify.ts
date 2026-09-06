/**
 * Email verification pipeline
 * 1) Syntax
 * 2) MX records (Google DNS-over-HTTPS)
 * 3) Disposable / role / typo detection
 * 4) Optional ZeroBounce API if ZEROBOUNCE_API_KEY is set
 *
 * Note: True mailbox SMTP probing is blocked on Vercel (port 25).
 * Paid APIs are the reliable way to know if an inbox exists.
 */

export type VerifyStatus =
  | 'valid'
  | 'invalid'
  | 'risky'
  | 'unknown'
  | 'disposable'
  | 'role';

export type VerifyResult = {
  email: string;
  status: VerifyStatus;
  score: number; // 0–100
  valid: boolean;
  checks: {
    syntax: boolean;
    mx: boolean;
    notDisposable: boolean;
    notRole: boolean;
    notTypo: boolean;
    provider?: string;
  };
  reason?: string;
  mxHosts?: string[];
};

const DISPOSABLE = new Set(
  [
    'mailinator.com',
    'guerrillamail.com',
    'guerrillamail.net',
    'tempmail.com',
    'temp-mail.org',
    '10minutemail.com',
    'yopmail.com',
    'trashmail.com',
    'discard.email',
    'getnada.com',
    'sharklasers.com',
    'spamgourmet.com',
    'maildrop.cc',
    'throwawaymail.com',
  ].map((d) => d.toLowerCase())
);

const ROLE_LOCALS = new Set([
  'info',
  'admin',
  'administrator',
  'support',
  'sales',
  'contact',
  'hello',
  'help',
  'office',
  'mail',
  'noreply',
  'no-reply',
  'donotreply',
  'marketing',
  'team',
  'hr',
  'jobs',
  'billing',
  'accounts',
  'webmaster',
  'postmaster',
  'abuse',
]);

const TYPO_DOMAINS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'yahooo.com': 'yahoo.com',
};

function syntaxOk(email: string): boolean {
  if (email.length > 254) return false;
  return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(
    email
  );
}

async function lookupMx(domain: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const answers = data.Answer || [];
    return answers
      .map((a: any) => String(a.data || '').replace(/\d+\s+/, '').replace(/\.$/, ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function zeroBounceCheck(email: string): Promise<{
  status: VerifyStatus;
  score: number;
  reason?: string;
} | null> {
  const key = process.env.ZEROBOUNCE_API_KEY;
  if (!key) return null;

  try {
    const url = `https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(
      key
    )}&email=${encodeURIComponent(email)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const zb = String(data.status || '').toLowerCase();

    // zero bounce: valid | invalid | catch-all | unknown | spamtrap | abuse | do_not_mail
    if (zb === 'valid') {
      return { status: 'valid', score: 95, reason: 'ZeroBounce: valid' };
    }
    if (zb === 'invalid' || zb === 'spamtrap' || zb === 'abuse') {
      return { status: 'invalid', score: 5, reason: `ZeroBounce: ${zb}` };
    }
    if (zb === 'catch-all' || zb === 'do_not_mail') {
      return { status: 'risky', score: 55, reason: `ZeroBounce: ${zb}` };
    }
    return { status: 'unknown', score: 40, reason: `ZeroBounce: ${zb || 'unknown'}` };
  } catch {
    return null;
  }
}

export async function verifyEmail(emailInput: string): Promise<VerifyResult> {
  const email = emailInput.trim().toLowerCase();

  const base: VerifyResult = {
    email,
    status: 'invalid',
    score: 0,
    valid: false,
    checks: {
      syntax: false,
      mx: false,
      notDisposable: true,
      notRole: true,
      notTypo: true,
    },
  };

  if (!syntaxOk(email)) {
    return { ...base, reason: 'Invalid email syntax' };
  }
  base.checks.syntax = true;

  const [local, domain] = email.split('@');
  if (!local || !domain) {
    return { ...base, reason: 'Missing local or domain' };
  }

  if (TYPO_DOMAINS[domain]) {
    base.checks.notTypo = false;
    return {
      ...base,
      status: 'invalid',
      score: 10,
      reason: `Possible typo domain (did you mean ${TYPO_DOMAINS[domain]}?)`,
    };
  }

  if (DISPOSABLE.has(domain)) {
    base.checks.notDisposable = false;
    return {
      ...base,
      status: 'disposable',
      score: 15,
      valid: false,
      reason: 'Disposable / temporary email domain',
    };
  }

  if (ROLE_LOCALS.has(local)) {
    base.checks.notRole = false;
    // role is risky but may still receive mail
  }

  const mxHosts = await lookupMx(domain);
  base.mxHosts = mxHosts;
  base.checks.mx = mxHosts.length > 0;

  if (!base.checks.mx) {
    return {
      ...base,
      status: 'invalid',
      score: 20,
      reason: 'No MX records for domain',
    };
  }

  // Optional paid verification
  const zb = await zeroBounceCheck(email);
  if (zb) {
    const valid = zb.status === 'valid';
    return {
      email,
      status: zb.status,
      score: zb.score,
      valid,
      checks: {
        ...base.checks,
        provider: 'zerobounce',
      },
      reason: zb.reason,
      mxHosts,
    };
  }

  // Free-tier scoring (cannot prove inbox existence)
  let score = 55; // syntax + MX
  if (base.checks.notRole) score += 15;
  else score -= 10;

  // Prefer person-like local parts
  if (/^[a-z]+\.[a-z]+$/.test(local)) score += 15;
  else if (/^[a-z]+$/.test(local) && local.length >= 3) score += 8;
  else if (/\d{4,}/.test(local)) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let status: VerifyStatus = 'unknown';
  if (!base.checks.notRole) status = 'role';
  else if (score >= 70) status = 'risky'; // deliverable domain, unconfirmed inbox
  else status = 'unknown';

  return {
    email,
    status,
    score,
    // Without paid API we never mark fully "valid"
    valid: false,
    checks: base.checks,
    reason: base.checks.notRole
      ? 'Domain accepts mail (MX ok). Inbox not confirmed without paid verifier.'
      : 'Role-based address (info@, sales@, etc.) — often shared / lower reply rate.',
    mxHosts,
  };
}

export async function verifyMany(
  emails: string[],
  options?: { concurrency?: number }
): Promise<VerifyResult[]> {
  const list = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const concurrency = Math.min(options?.concurrency ?? 5, 10);
  const out: VerifyResult[] = [];

  for (let i = 0; i < list.length; i += concurrency) {
    const batch = list.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((e) => verifyEmail(e)));
    out.push(...results);
  }

  return out;
}
