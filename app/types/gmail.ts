export interface GmailVerificationResult {
  email: string;
  valid: boolean;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  method: string;
}

export interface GmailBatchResult {
  totalVerified: number;
  totalValid: number;
  validityRate: number;
  results: GmailVerificationResult[];
}

export interface GmailGenerationOptions {
  name: string;
  maxVariations?: number;
  includeNumbers?: boolean;
}