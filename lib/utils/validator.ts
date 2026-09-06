export class Validator {
  static isValidEmail(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  }

  static isValidGmail(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);
  }

  static isValidCIK(cik: string): boolean {
    return /^\d{10}$/.test(cik) || /^\d{1,10}$/.test(cik);
  }

  static sanitizeInput(input: string): string {
    return input.replace(/[<>]/g, '').trim();
  }
}