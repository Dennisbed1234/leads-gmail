export class AnalyticsEngine {
  static analyzeLeads(leads: any[]) {
    return {
      total: leads.length,
      averageScore: this.calculateAverageScore(leads),
      bySource: this.groupBySource(leads),
      byStatus: this.groupByStatus(leads),
      topCompanies: this.getTopCompanies(leads),
      scoreDistribution: this.getScoreDistribution(leads),
    };
  }

  private static calculateAverageScore(leads: any[]): number {
    if (leads.length === 0) return 0;
    const