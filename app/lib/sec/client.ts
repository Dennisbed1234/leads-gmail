import { SecCompany, SecFiling, SecExecutive } from './types';

const SEC_BASE_URL = 'https://www.sec.gov';
const SEC_ARCHIVES = `${SEC_BASE_URL}/Archives/edgar/data`;

export class SecClient {
  private userAgent: string;

  constructor() {
    this.userAgent = process.env.SEC_USER_AGENT || 
      'LeadBot Pro (contact@example.com)';
  }

  async getCompany(cik: string): Promise<SecCompany | null> {
    const url = `${SEC_ARCHIVES}/${cik.padStart(10, '0')}/`;
    
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': this.userAgent }
      });

      if (!response.ok) return null;
      const html = await response.text();
      
      return this.parseCompanyPage(html, cik);
    } catch (error) {
      console.error(`Error fetching company ${cik}:`, error);
      return null;
    }
  }

  async getFilings(cik: string, limit: number = 10): Promise<SecFiling[]> {
    const cikPadded = cik.padStart(10, '0');
    const url = `${SEC_ARCHIVES}/${cikPadded}/index.json`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) return [];
      const data = await response.json();
      
      return this.parseFilings(data, cik, limit);
    } catch (error) {
      console.error(`Error fetching filings for ${cik}:`, error);
      return [];
    }
  }

  async extractExecutives(cik: string, filingType: string = '10-K'): Promise<SecExecutive[]> {
    const filings = await this.getFilings(cik);
    const targetFiling = filings.find(f => f.type === filingType);
    
    if (!targetFiling) return [];

    try {
      const response = await fetch(targetFiling.url, {
        headers: { 'User-Agent': this.userAgent }
      });

      if (!response.ok) return [];
      const text = await response.text();
      
      return this.parseExecutives(text, cik);
    } catch (error) {
      console.error(`Error extracting executives:`, error);
      return [];
    }
  }

  private parseCompanyPage(html: string, cik: string): SecCompany {
    const company: SecCompany = { cik, name: '' };
    
    // Extract name
    const nameMatch = html.match(/<span[^>]*class="companyName"[^>]*>([^<]+)<\/span>/);
    if (nameMatch) company.name = nameMatch[1].trim();

    // Extract ticker
    const tickerMatch = html.match(/Ticker:\s*<\/span>\s*<span[^>]*>([A-Z]+)<\/span>/i);
    if (tickerMatch) company.ticker = tickerMatch[1];

    // Extract industry
    const industryMatch = html.match(/Industry:\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/i);
    if (industryMatch) company.industry = industryMatch[1].trim();

    // Extract address
    const addressMatch = html.match(/Address:\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/i);
    if (addressMatch) company.address = addressMatch[1].trim();

    return company;
  }

  private parseFilings(data: any, cik: string, limit: number): SecFiling[] {
    if (!data?.directory?.item) return [];

    return data.directory.item
      .filter((item: any) => item.type && item.name)
      .slice(0, limit)
      .map((item: any) => ({
        accessionNo: item.name.replace('.txt', '').replace('.html', ''),
        type: item.type,
        url: `${SEC_ARCHIVES}/${cik.padStart(10, '0')}/${item.name}`,
        date: item.date || new Date().toISOString().split('T')[0]
      }));
  }

  private parseExecutives(text: string, cik: string): SecExecutive[] {
    const executives: SecExecutive[] = [];
    
    const patterns = [
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*,\s*(CEO|CFO|CTO|COO|President|Chairman|Vice President|Director|Secretary|Treasurer|Chief\s+(?:Executive|Financial|Technology|Operating|Information|Marketing|Legal)\s+Officer)/gi,
      /(Chief\s+(?:Executive|Financial|Technology|Operating|Information|Marketing|Legal)\s+Officer)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let name = match[1] || match[2];
        let title = match[2] || match[1];
        
        name = name.trim();
        title = title.trim();

        if (this.isValidExecutive(name, title)) {
          executives.push({
            name: this.cleanName(name),
            title: this.cleanTitle(title),
            cik,
            source: 'SEC EDGAR'
          });
        }
      }
    }

    // Remove duplicates
    const unique = new Map();
    for (const exec of executives) {
      const key = exec.name + '|' + exec.title;
      if (!unique.has(key)) unique.set(key, exec);
    }

    return Array.from(unique.values());
  }

  private isValidExecutive(name: string, title: string): boolean {
    const skipTerms = ['Information', 'Table', 'Contents', 'Note', 'Exhibit', 'Page', 'Index'];
    if (skipTerms.some(term => name.includes(term))) return false;
    
    const nameParts = name.split(' ');
    if (nameParts.length < 2) return false;
    if (!nameParts.every(part => /^[A-Z][a-z]+/.test(part))) return false;
    if (title.length < 3 || title.length > 50) return false;
    
    return true;
  }

  private cleanName(name: string): string {
    return name.replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  private cleanTitle(title: string): string {
    return title.replace(/[^A-Za-z\s\-]/g, '').replace(/\s+/g, ' ').trim();
  }
}

export const secClient = new SecClient();