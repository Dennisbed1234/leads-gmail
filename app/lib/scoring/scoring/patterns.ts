export class PatternDetector {
  static detectIndustryPatterns(leads: any[]): any {
    const industryCount: Record<string, number> = {};
    
    for (const lead of leads) {
      const industry = lead.industry || 'Unknown';
      industryCount[industry] = (industryCount[industry] || 0) + 1;
    }

    return Object.entries(industryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([industry, count]) => ({ industry, count }));
  }

  static detectTitlePatterns(leads: any[]): any {
    const titleCount: Record<string, number> = {};
    
    for (const lead of leads) {
      const title = lead.title || 'Unknown';
      const level = this.getTitleLevel(title);
      titleCount[level] = (titleCount[level] || 0) + 1;
    }

    return Object.entries(titleCount)
      .sort((a, b) => b[1] - a[1])
      .map(([level, count]) => ({ level, count }));
  }

  private static getTitleLevel(title: string): string {
    if (/CEO|CFO|CTO|COO|President|Founder/i.test(title)) return 'C-Suite';
    if (/VP|Vice President/i.test(title)) return 'VP';
    if (/Director/i.test(title)) return 'Director';
    if (/Manager|Lead/i.test(title)) return 'Manager';
    return 'Individual';
  }
}