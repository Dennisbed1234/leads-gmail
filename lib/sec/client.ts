import { SecCompany, SecFiling, SecExecutive } from './types';

const SEC_BASE_URL = 'https://www.sec.gov';
const SEC_ARCHIVES = `${SEC_BASE_URL}/Archives/edgar/data`;

export class SecClient {
  private userAgent: string;

  constructor() {
    this.userAgent =
      process.env.SEC_USER_AGENT ||
      'LeadBot Pro admin@example.com';
  }

  private getHeaders(accept = 'text/html') {
    return {
      'User-Agent': this.userAgent,
      Accept: accept,
      'Accept-Encoding': 'gzip, deflate',
      Host: 'www.sec.gov',
    };
  }

  async getCompany(cik: string): Promise<SecCompany | null> {
    const cleanCik = cik.replace(/\D/g, '');
    const paddedCik = cleanCik.padStart(10, '0');

    const url = `${SEC_ARCHIVES}/${paddedCik}/`;

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error(
          `SEC company request failed: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const html = await response.text();

      return this.parseCompanyPage(html, cleanCik);
    } catch (error) {
      console.error(`Error fetching company ${cleanCik}:`, error);
      return null;
    }
  }

  async getFilings(
    cik: string,
    limit: number = 20
  ): Promise<SecFiling[]> {
    const cleanCik = cik.replace(/\D/g, '');
    const paddedCik = cleanCik.padStart(10, '0');

    const submissionsUrl =
      `${SEC_BASE_URL}/files/submissions/CIK${paddedCik}.json`;

    try {
      const response = await fetch(submissionsUrl, {
        headers: this.getHeaders('application/json'),
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error(
          `SEC submissions request failed: ${response.status} ${response.statusText}`
        );

        return [];
      }

      const data = await response.json();
      const recent = data?.filings?.recent;

      if (!recent) {
        return [];
      }

      const filings: SecFiling[] = [];

      const forms = recent.form || [];
      const accessions = recent.accessionNumber || [];
      const primaryDocuments = recent.primaryDocument || [];
      const filingDates = recent.filingDate || [];

      for (
        let i = 0;
        i < forms.length && filings.length < limit;
        i++
      ) {
        const form = forms[i];
        const accessionNumber = accessions[i];
        const primaryDocument = primaryDocuments[i];

        const filingDate =
          filingDates[i] ||
          new Date().toISOString().split('T')[0];

        if (!form || !accessionNumber || !primaryDocument) {
          continue;
        }

        const accessionNo = accessionNumber.replace(/-/g, '');

        const url =
          `${SEC_ARCHIVES}/${cleanCik}/${accessionNo}/${primaryDocument}`;

        filings.push({
          accessionNo: accessionNumber,
          type: form,
          url,
          date: filingDate,
        });
      }

      return filings;
    } catch (error) {
      console.error(`Error fetching filings for ${cleanCik}:`, error);
      return [];
    }
  }

  async extractExecutives(
    cik: string,
    filingType: string = '10-K'
  ): Promise<SecExecutive[]> {
    const cleanCik = cik.replace(/\D/g, '');

    const filings = await this.getFilings(cleanCik, 50);

    const normalizedType = filingType.toUpperCase();

    const targetFiling = filings.find(
      (filing) =>
        filing.type.toUpperCase() === normalizedType
    );

    if (!targetFiling) {
      console.error(
        `No ${normalizedType} filing found for CIK ${cleanCik}`
      );

      return [];
    }

    console.log(
      `Using SEC filing ${targetFiling.accessionNo}: ${targetFiling.url}`
    );

    try {
      const response = await fetch(targetFiling.url, {
        headers: this.getHeaders(),
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error(
          `SEC filing request failed: ${response.status} ${response.statusText}`
        );

        return [];
      }

      const text = await response.text();

      if (!text || text.length < 100) {
        console.error('SEC filing returned insufficient content');
        return [];
      }

      return this.parseExecutives(text, cleanCik);
    } catch (error) {
      console.error(
        `Error extracting executives for ${cleanCik}:`,
        error
      );

      return [];
    }
  }

  private parseCompanyPage(
    html: string,
    cik: string
  ): SecCompany {
    const company: SecCompany = {
      cik,
      name: '',
    };

    const cleanedHtml = this.stripHtml(html);

    const nameMatch = html.match(
      /<span[^>]*class=["'][^"']*companyName[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
    );

    if (nameMatch) {
      company.name = this.cleanText(nameMatch[1]);
    }

    if (!company.name) {
      const titleMatch = html.match(
        /<title[^>]*>([\s\S]*?)<\/title>/i
      );

      if (titleMatch) {
        company.name = this.cleanText(titleMatch[1])
          .replace(/\s*-\s*SEC\.gov.*$/i, '')
          .trim();
      }
    }

    const tickerMatch = cleanedHtml.match(
      /Ticker:\s*([A-Z][A-Z0-9.-]{0,9})/i
    );

    if (tickerMatch) {
      company.ticker = tickerMatch[1].toUpperCase();
    }

    const industryMatch = cleanedHtml.match(
      /Industry:\s*([^\n]+?)(?:\s+Address:|\s+State:|\s+Zip:|$)/i
    );

    if (industryMatch) {
      company.industry = industryMatch[1].trim();
    }

    const addressMatch = cleanedHtml.match(
      /Address:\s*([^\n]+?)(?:\s+State:|\s+Zip:|$)/i
    );

    if (addressMatch) {
      company.address = addressMatch[1].trim();
    }

    return company;
  }

  private parseFilings(
    data: any,
    cik: string,
    limit: number
  ): SecFiling[] {
    if (!data?.directory?.item) {
      return [];
    }

    return data.directory.item
      .filter(
        (item: any) =>
          item.type &&
          item.name
      )
      .slice(0, limit)
      .map((item: any) => ({
        accessionNo: item.name
          .replace('.txt', '')
          .replace('.html', ''),
        type: item.type,
        url:
          `${SEC_ARCHIVES}/${cik.padStart(10, '0')}/${item.name}`,
        date:
          item.date ||
          new Date().toISOString().split('T')[0],
      }));
  }

  private parseExecutives(
    text: string,
    cik: string
  ): SecExecutive[] {
    const executives: SecExecutive[] = [];

    const cleaned = this.normalizeDocument(text);

    const titlePattern =
      '(?:' +
      'CEO|' +
      'CFO|' +
      'COO|' +
      'CTO|' +
      'CIO|' +
      'CMO|' +
      'Chief\\s+(?:Executive|Financial|Operating|Technology|Information|Marketing|Legal|Accounting|Human\\s+Resources)\\s+Officer|' +
      'President|' +
      'Chairman|' +
      'Vice\\s+President|' +
      'Executive\\s+Vice\\s+President|' +
      'Senior\\s+Vice\\s+President|' +
      'Secretary|' +
      'Treasurer' +
      ')';

    /*
     * Name, Title
     *
     * Example:
     * John Smith, Chief Executive Officer
     */
    const patternOne = new RegExp(
      "\\b([A-Z][A-Za-z-']+(?:\\s+[A-Z][A-Za-z-']+){1,4})\\s*,?\\s+(" +
        titlePattern +
        ')\\b',
      'gi'
    );

    /*
     * Title Name
     *
     * Example:
     * Chief Executive Officer John Smith
     */
    const patternTwo = new RegExp(
      '\\b(' +
        titlePattern +
        ')\\s+([A-Z][A-Za-z-\\']+(?:\\s+[A-Z][A-Za-z-\\']+){1,4})\\b',
      'gi'
    );

    /*
     * Name followed by title with larger whitespace.
     */
    const patternThree = new RegExp(
      "\\b([A-Z][A-Za-z-']+(?:\\s+[A-Z][A-Za-z-']+){1,4})\\s{2,}(" +
        titlePattern +
        ')\\b',
      'gi'
    );

    let match: RegExpExecArray | null;

    while ((match = patternOne.exec(cleaned)) !== null) {
      this.addExecutive(
        executives,
        match[1],
        match[2],
        cik
      );
    }

    while ((match = patternTwo.exec(cleaned)) !== null) {
      this.addExecutive(
        executives,
        match[2],
        match[1],
        cik
      );
    }

    while ((match = patternThree.exec(cleaned)) !== null) {
      this.addExecutive(
        executives,
        match[1],
        match[2],
        cik
      );
    }

    /*
     * Search common SEC executive sections.
     */
    const sectionPatterns = [
      /directors?\s+and\s+executive\s+officers?/i,
      /executive\s+officers?/i,
      /information\s+about\s+our\s+executive\s+officers?/i,
      /directors?\s+and\s+officers?/i,
    ];

    for (const sectionPattern of sectionPatterns) {
      const sectionMatch = sectionPattern.exec(cleaned);

      if (!sectionMatch) {
        continue;
      }

      const sectionStart = sectionMatch.index;

      const section = cleaned.slice(
        sectionStart,
        sectionStart + 15000
      );

      const sectionRegex = new RegExp(
        "\\b([A-Z][A-Za-z-']+(?:\\s+[A-Z][A-Za-z-']+){1,4})\\s*,?\\s+(" +
          titlePattern +
          ')\\b',
        'gi'
      );

      while ((match = sectionRegex.exec(section)) !== null) {
        this.addExecutive(
          executives,
          match[1],
          match[2],
          cik
        );
      }
    }

    const unique = new Map<string, SecExecutive>();

    for (const executive of executives) {
      const name = executive.name
        .toLowerCase()
        .trim();

      const title = executive.title
        .toLowerCase()
        .trim();

      const key = `${name}|${title}`;

      if (!unique.has(key)) {
        unique.set(key, executive);
      }
    }

    return Array.from(unique.values()).slice(0, 100);
  }

  private addExecutive(
    executives: SecExecutive[],
    rawName: string,
    rawTitle: string,
    cik: string
  ) {
    const name = this.cleanName(rawName);
    const title = this.cleanTitle(rawTitle);

    if (!this.isValidExecutive(name, title)) {
      return;
    }

    executives.push({
      name,
      title,
      cik,
      source: 'SEC EDGAR',
    });
  }

  private isValidExecutive(
    name: string,
    title: string
  ): boolean {
    const skipTerms = [
      'Information',
      'Table',
      'Contents',
      'Note',
      'Exhibit',
      'Page',
      'Index',
      'Item',
      'Company',
      'Form',
      'United States',
      'Securities Exchange',
      'Commission',
      'Annual Report',
      'Fiscal Year',
    ];

    const lowerName = name.toLowerCase();

    if (
      skipTerms.some((term) =>
        lowerName.includes(term.toLowerCase())
      )
    ) {
      return false;
    }

    const nameParts = name
      .split(/\s+/)
      .filter(Boolean);

    if (
      nameParts.length < 2 ||
      nameParts.length > 5
    ) {
      return false;
    }

    if (
      !nameParts.every((part) =>
        /^[A-Z][A-Za-z'-]*$/.test(part)
      )
    ) {
      return false;
    }

    if (
      title.length < 3 ||
      title.length > 80
    ) {
      return false;
    }

    return true;
  }

  private cleanName(name: string): string {
    return name
      .replace(/\s+/g, ' ')
      .replace(/^[,.;:\s]+|[,.;:\s]+$/g, '')
      .trim();
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .replace(/^[,.;:\s]+|[,.;:\s]+$/g, '')
      .trim();
  }

  private cleanText(text: string): string {
    return this.decodeHtmlEntities(
      text
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  private stripHtml(html: string): string {
    return this.decodeHtmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  private normalizeDocument(text: string): string {
    return this.decodeHtmlEntities(
      text
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<\/td>/gi, ' ')
        .replace(/<\/th>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }
}

export const secClient = new SecClient();