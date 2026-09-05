export class BatchVerifier {
  private verifier: GmailVerifier;
  private batchSize: number = 100;
  private concurrencyLimit: number = 10;

  constructor() {
    this.verifier = new GmailVerifier();
  }

  /**
   * Verify a batch of emails with concurrency control
   */
  async verifyBatch(emails: string[]): Promise<BatchResult> {
    const results: VerificationResult[] = [];
    const batches = this.chunkArray(emails, this.batchSize);
    
    let totalVerified = 0;
    let totalValid = 0;

    for (const batch of batches) {
      const batchResults = await this.verifyBatchWithConcurrency(batch);
      results.push(...batchResults);
      
      totalVerified += batchResults.length;
      totalValid += batchResults.filter(r => r.valid).length;
    }

    return {
      totalVerified,
      totalValid,
      validityRate: (totalValid / totalVerified) * 100,
      results
    };
  }

  /**
   * Verify a batch with concurrency limit
   */
  private async verifyBatchWithConcurrency(emails: string[]): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];
    const chunks = this.chunkArray(emails, this.concurrencyLimit);

    for (const chunk of chunks) {
      const promises = chunk.map(email => this.verifier.verifyEmail(email));
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get only valid emails from results
   */
  static getValidEmails(results: VerificationResult[]): string[] {
    return results
      .filter(r => r.valid && r.confidence === 'high')
      .map(r => r.email);
  }

  /**
   * Get only high-confidence emails
   */
  static getHighConfidenceEmails(results: VerificationResult[]): string[] {
    return results
      .filter(r => r.confidence === 'high')
      .map(r => r.email);
  }
}