interface VerificationResult {
  email: string;
  valid: boolean;
  score: number;
  confidence: 'high' | 'medium' | 'low';
}

export class GmailVerifier {
  private cache: Map<string, VerificationResult> = new Map();

  async verifyEmail(email: string): Promise<VerificationResult> {
    if (this.cache.has(email)) {
      return this.cache.get(email)!;
    }

    const result = await this.verifyMultipleMethods(email);
    this.cache.set(email, result);
    return result;
  }

  private async verifyMultipleMethods(email: string): Promise<VerificationResult> {
    let totalScore = 0;

    // Method 1: Strict Gmail format check (required)
    if (!this.isValidEmailFormat(email)) {
      return {
        email,
        valid: false,
        score: 0,
        confidence: 'low',
      };
    }
    totalScore += 40;

    // Method 2: MX record check for gmail.com (should always pass)
    if (await this.hasValidMX(email)) {
      totalScore += 40;
    }

    // Method 3: Pattern quality bonus (more realistic-looking addresses score higher)
    totalScore += this.getPatternQualityScore(email);

    // Cap at 100
    totalScore = Math.min(totalScore, 100);

    // Consider valid if format + MX at minimum (score >= 70)
    const valid = totalScore >= 70;

    return {
      email,
      valid,
      score: totalScore,
      confidence: this.getConfidenceLevel(totalScore),
    };
  }

  private isValidEmailFormat(email: string): boolean {
    // Strict: local part rules + @gmail.com only
    return /^[a-zA-Z0-9]([a-zA-Z0-9._%+-]{0,62}[a-zA-Z0-9])?@gmail\.com$/.test(
      email
    );
  }

  private async hasValidMX(email: string): Promise<boolean> {
    const domain = email.split('@')[1];
    if (domain !== 'gmail.com') return false;

    try {
      const response = await fetch(
        `https://dns.google/resolve?name=${domain}&type=MX`,
        { cache: 'force-cache' }
      );
      const data = await response.json();
      return Array.isArray(data.Answer) && data.Answer.length > 0;
    } catch {
      // On failure, still accept gmail.com as it is known to have MX
      return true;
    }
  }

  private getPatternQualityScore(email: string): number {
    const local = email.split('@')[0].toLowerCase();

    // Prefer clean first.last or firstlast patterns over random numbers
    if (/^[a-z]+\.[a-z]+$/.test(local)) return 20; // john.smith
    if (/^[a-z]+[a-z]+$/.test(local) && local.length >= 6) return 15; // johnsmith
    if (/^[a-z]\.[a-z]+$/.test(local)) return 12; // j.smith
    if (/^[a-z]+_[a-z]+$/.test(local)) return 10;
    if (/^[a-z]+-[a-z]+$/.test(local)) return 8;
    if (/\d{1,4}$/.test(local)) return 5; // has trailing numbers

    return 0;
  }

  private getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 90) return 'high';
    if (score >= 75) return 'medium';
    return 'low';
  }
}
