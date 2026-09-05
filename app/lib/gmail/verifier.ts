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
    let methodsChecked = 0;

    // Method 1: Format check
    if (this.isValidEmailFormat(email)) {
      totalScore += 30;
      methodsChecked++;
    }

    // Method 2: Domain check
    if (await this.hasValidMX(email)) {
      totalScore += 35;
      methodsChecked++;
    }

    // Method 3: Google account check
    if (await this.googleAccountExists(email)) {
      totalScore += 35;
      methodsChecked++;
    }

    const averageScore = methodsChecked > 0 ? Math.round(totalScore / methodsChecked) : 0;
    const valid = averageScore > 50;

    return {
      email,
      valid,
      score: averageScore,
      confidence: this.getConfidenceLevel(averageScore)
    };
  }

  private isValidEmailFormat(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);
  }

  private async hasValidMX(email: string): Promise<boolean> {
    const domain = email.split('@')[1];
    try {
      const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
      const data = await response.json();
      return data.Answer && data.Answer.length > 0;
    } catch {
      return false;
    }
  }

  private async googleAccountExists(email: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://accounts.google.com/_/lookup/email?email=${encodeURIComponent(email)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const text = await response.text();
      return text.includes('You have an account');
    } catch {
      return false;
    }
  }

  private getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }
}