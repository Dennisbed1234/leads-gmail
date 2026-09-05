export class ReportGenerator {
  static generateCSV(leads: any[]): string {
    const headers = ['Name', 'Title', 'Company', 'Email', 'Source', 'Score', 'Status'];
    const rows = leads.map(lead => [
      lead.name,
      lead.title || '',
      lead.company || '',
      lead.email || '',
      lead.source || '',
      lead.score || 0,
      lead.status || 'NEW',
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  static generateSummary(leads: any[]): string {
    const total = leads.length;
    const avgScore = leads.reduce((sum, l) => sum + (l.score || 0), 0) / total;
    const verified = leads.filter(l => l.email).length;

    return `
Lead Report Summary
===================
Total Leads: ${total}
Average Score: ${avgScore.toFixed(1)}
Verified Emails: ${verified}
Top Source: ${this.getTopSource(leads)}
    `.trim();
  }

  private static getTopSource(leads: any[]): string {
    const sources: Record<string, number> = {};
    for (const lead of leads) {
      const source = lead.source || 'Unknown';
      sources[source] = (sources[source] || 0) + 1;
    }
    const sorted = Object.entries(sources).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : 'None';
  }
}