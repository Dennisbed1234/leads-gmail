export type EmailCandidate = {
  email: string;
  pattern: string;
  type: 'gmail' | 'corporate';
  priority: number;
};

export class EmailGenerator {
  /** Generate ranked email candidates for a person */
  static generate(
    name: string,
    options?: { domain?: string; includeGmail?: boolean }
  ): EmailCandidate[] {
    const includeGmail = options?.includeGmail !== false;
    const domain = options?.domain?.toLowerCase().replace(/^@/, '').trim();

    const cleaned = this.cleanName(name);
    const parts = cleaned.split(' ').filter(Boolean);
    if (parts.length === 0) return [];

    const first = parts[0];
    const last = parts[parts.length - 1];
    const middle = parts.length > 2 ? parts[1] : '';
    const fi = first[0] || '';
    const li = last[0] || '';

    const locals: { local: string; pattern: string; priority: number }[] = [
      { local: `${first}.${last}`, pattern: 'first.last', priority: 100 },
      { local: `${first}${last}`, pattern: 'firstlast', priority: 90 },
      { local: `${fi}${last}`, pattern: 'flast', priority: 85 },
      { local: `${fi}.${last}`, pattern: 'f.last', priority: 80 },
      { local: `${first}_${last}`, pattern: 'first_last', priority: 70 },
      { local: `${first}-${last}`, pattern: 'first-last', priority: 65 },
      { local: `${last}.${first}`, pattern: 'last.first', priority: 60 },
      { local: `${first}${li}`, pattern: 'firstl', priority: 55 },
      { local: `${first}.${li}`, pattern: 'first.l', priority: 50 },
    ];

    if (middle) {
      const mi = middle[0];
      locals.push(
        { local: `${first}.${mi}.${last}`, pattern: 'first.m.last', priority: 75 },
        { local: `${fi}${mi}${last}`, pattern: 'fmlast', priority: 72 }
      );
    }

    const seen = new Set<string>();
    const results: EmailCandidate[] = [];

    const push = (local: string, pattern: string, type: 'gmail' | 'corporate', priority: number) => {
      const cleanLocal = local.replace(/[^a-z0-9._+-]/g, '');
      if (cleanLocal.length < 2 || cleanLocal.length > 64) return;
      const email = `${cleanLocal}@${type === 'gmail' ? 'gmail.com' : domain}`;
      if (seen.has(email)) return;
      seen.add(email);
      results.push({ email, pattern, type, priority });
    };

    // Corporate first (higher B2B value)
    if (domain && domain !== 'gmail.com') {
      for (const l of locals) {
        push(l.local, l.pattern, 'corporate', l.priority + 20);
      }
    }

    if (includeGmail) {
      for (const l of locals) {
        push(l.local, l.pattern, 'gmail', l.priority);
      }
    }

    return results.sort((a, b) => b.priority - a.priority);
  }

  static topGmails(name: string, limit = 5): string[] {
    return this.generate(name, { includeGmail: true })
      .filter((c) => c.type === 'gmail')
      .slice(0, limit)
      .map((c) => c.email);
  }

  static topCorporate(name: string, domain: string, limit = 5): string[] {
    return this.generate(name, { domain, includeGmail: false })
      .slice(0, limit)
      .map((c) => c.email);
  }

  /** Guess company email domain from company name / ticker */
  static guessDomain(companyName: string, ticker?: string): string | undefined {
    if (ticker && /^[A-Z]{1,5}$/.test(ticker)) {
      // common but imperfect
    }

    const name = companyName
      .toLowerCase()
      .replace(/\b(inc|incorporated|corp|corporation|ltd|llc|co|company|plc|holdings|group|the)\b\.?/gi, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '')
      .trim();

    if (name.length >= 3 && name.length <= 40) {
      return `${name}.com`;
    }
    return undefined;
  }

  private static cleanName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(mr|mrs|ms|dr|prof|rev|hon|jr|sr|ii|iii|iv)\b\.?\s*/gi, '')
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
