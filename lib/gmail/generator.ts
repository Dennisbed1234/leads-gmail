export class GmailGenerator {
  static generateGmails(name: string): string[] {
    const cleaned = this.cleanName(name);
    const parts = cleaned.split(' ');
    
    if (parts.length < 2) {
      return [`${parts[0]}@gmail.com`];
    }

    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    
    const patterns = [
      `${firstName}${lastName}`,
      `${firstName}.${lastName}`,
      `${firstName}_${lastName}`,
      `${firstName}-${lastName}`,
      `${firstName}${lastName}${Math.floor(Math.random() * 100)}`,
      `${firstName[0]}${lastName}`,
      `${firstName[0]}.${lastName}`,
      `${firstName}${lastName[0]}`,
      `${firstName}.${lastName[0]}`,
      `${lastName}${firstName}`,
      `${firstName}${Math.floor(Math.random() * 1000)}`,
    ];

    return [...new Set(patterns)].map(email => `${email}@gmail.com`);
  }

  static getMostLikelyGmails(name: string): string[] {
    const all = this.generateGmails(name);
    return all.slice(0, 10);
  }

  private static cleanName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(mr|mrs|ms|dr|prof|rev|hon|jr|sr)\b\.?\s*/gi, '')
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}