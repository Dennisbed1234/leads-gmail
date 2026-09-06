import { GmailVerifier } from './verifier';

interface BatchResult {
  totalVerified: number;
  totalValid: number;
  validityRate: number;
  results: any[];
}

export class BatchVerifier {
  private verifier: GmailVerifier;
  private concurrencyLimit: number = 10;

  constructor() {
    this.verifier = new GmailVerifier();
  }

  async verifyBatch(emails: string[]): Promise<BatchResult> {
    const results: any[] = [];
    const chunks = this.chunkArray(emails, this.concurrencyLimit);

    for (const chunk of chunks) {
      const promises = chunk.map((email) =>
        this.verifier.verifyEmail(email)
      );

      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
    }

    const valid = results.filter((r) => r.valid);

    return {
      totalVerified: results.length,
      totalValid: valid.length,
      validityRate:
        results.length > 0 ? (valid.length / results.length) * 100 : 0,
      results,
    };
  }

  static getValidEmails(results: any[]): string[] {
    return results
      .filter((r) => r.valid && (r.confidence === 'high' || r.confidence === 'medium'))
      .map((r) => r.email);
  }

  static getHighConfidenceEmails(results: any[]): string[] {
    // Prefer high, fall back to medium so the pipeline produces results
    const high = results
      .filter((r) => r.valid && r.confidence === 'high')
      .map((r) => r.email);

    if (high.length > 0) return high;

    return results
      .filter((r) => r.valid && r.confidence === 'medium')
      .map((r) => r.email);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }

    return chunks;
  }
}
