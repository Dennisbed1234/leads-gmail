export class GmailGenerator {
  static generateGmails(name: string): string[] {
    const cleaned = this.cleanName(name);
    const parts = cleaned.split(' ').filter(Boolean);

    if (parts.length === 0) {
      return [];
    }

    if (parts.length === 1) {
      return [`${parts[0]}@gmail.com`];
    }

    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    const middle = parts.length > 2 ? parts[1] : '';

    const patterns = [
      // Highest quality first
      `${firstName}.${lastName}`,
      `${firstName}${lastName}`,
      `${firstName[0]}.${lastName}`,
      `${firstName[0]}${lastName}`,
      `${firstName}_${lastName}`,
      `${firstName}-${lastName}`,
      `${lastName}.${firstName}`,
      `${lastName}${firstName}`,
      `${firstName}.${lastName[0]}`,
      `${firstName}${lastName[0]}`,
    ];

    if (middle) {
      patterns.push(
        `${firstName}.${middle[0]}.${lastName}`,
        `${firstName[0]}${middle[0]}${lastName}`
      );
    }

    // Deduplicate and ensure valid local parts
    const unique = [...new Set(patterns)].filter(
      (p) => p.length >= 3 && p.length <= 64 && /^[a-z0-9._-]+$/.test(p)
    );

    return unique.map((local) => `${local}@gmail.com`);
  }

  static getMostLikelyGmails(name: string): string[] {
    return this.generateGmails(name).slice(0, 10);
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
