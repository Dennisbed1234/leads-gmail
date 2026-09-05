export class GmailGenerator {
  /**
   * Generate all possible Gmail addresses from a name
   */
  static generateGmails(name: string): string[] {
    const cleaned = this.cleanName(name);
    const parts = cleaned.split(' ');
    
    if (parts.length < 2) {
      return [this.generateSingleNameGmail(parts[0])];
    }

    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    const middleName = parts.length > 2 ? parts[1] : '';
    
    // Common Gmail patterns
    const patterns = [
      // Standard formats
      `${firstName}${lastName}`,
      `${firstName}.${lastName}`,
      `${firstName}_${lastName}`,
      `${firstName}-${lastName}`,
      `${firstName}${lastName}${this.randomNumber()}`,
      
      // Initial + last name
      `${firstName[0]}${lastName}`,
      `${firstName[0]}.${lastName}`,
      `${firstName[0]}_${lastName}`,
      
      // First name + initial
      `${firstName}${lastName[0]}`,
      `${firstName}.${lastName[0]}`,
      `${firstName}_${lastName[0]}`,
      
      // Full name variations
      `${firstName}${middleName}${lastName}`,
      `${firstName}.${middleName}.${lastName}`,
      
      // Common variations
      `${firstName}${this.getCommonSuffix()}`,
      `${lastName}${firstName}`,
    ];

    // Add common prefix/suffix variations
    const withNumbers = patterns.flatMap(p => [
      p,
      `${p}${this.randomNumber()}`,
      `${p}${this.randomNumber()}${this.randomNumber()}`,
      `${this.randomNumber()}${p}`,
    ]);

    // Remove duplicates and filter
    const unique = [...new Set([...patterns, ...withNumbers])];
    
    // Add @gmail.com
    return unique.map(email => `${email}@gmail.com`);
  }

  /**
   * Clean name - remove titles, extra spaces, special chars
   */
  private static cleanName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(mr|mrs|ms|dr|prof|rev|hon|sir|dame|judge|gen|adm|capt|col|maj|lt|sgt|jr|sr)\b\.?\s*/gi, '')
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generate Gmail for single-name executives
   */
  private static generateSingleNameGmail(name: string): string {
    const suffixes = ['', '1', '2', '3', '123', '2024', '24', 'official', 'real'];
    return suffixes.map(s => `${name}${s}@gmail.com`);
  }

  /**
   * Get common Gmail suffixes
   */
  private static getCommonSuffix(): string {
    const suffixes = ['', 'official', 'real', 'work', 'professional', 'business'];
    return suffixes[Math.floor(Math.random() * suffixes.length)];
  }

  /**
   * Generate a random number (0-999)
   */
  private static randomNumber(): string {
    return String(Math.floor(Math.random() * 1000));
  }

  /**
   * Generate multiple variations with high probability
   */
  static getMostLikelyGmails(name: string): string[] {
    const all = this.generateGmails(name);
    
    // Prioritize most common patterns
    const priorities = [
      (email: string) => /^[a-z]+\.[a-z]+@gmail\.com$/.test(email),
      (email: string) => /^[a-z]+[a-z]+@gmail\.com$/.test(email),
      (email: string) => /^[a-z]+\d+@gmail\.com$/.test(email),
    ];

    const prioritized = all.sort((a, b) => {
      for (const priority of priorities) {
        const aScore = priority(a) ? 1 : 0;
        const bScore = priority(b) ? 1 : 0;
        if (aScore !== bScore) return bScore - aScore;
      }
      return 0;
    });

    return prioritized;
  }
}