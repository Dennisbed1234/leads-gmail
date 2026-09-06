export interface Lead {
  id?: string;
  name?: string;
  title?: string;
  company?: string;
  email?: string;
  source?: string;
  status?: string;
  score?: number;
}

export class AnalyticsEngine {
  static analyzeLeads(leads: Lead[]) {
    return {
      total: leads.length,
      averageScore: this.calculateAverageScore(leads),
      bySource: this.groupBySource(leads),
      byStatus: this.groupByStatus(leads),
      topCompanies: this.getTopCompanies(leads),
      scoreDistribution: this.getScoreDistribution(leads),
    };
  }

  private static calculateAverageScore(leads: Lead[]): number {
    if (leads.length === 0) return 0;

    const total = leads.reduce(
      (sum, lead) => sum + (typeof lead.score === 'number' ? lead.score : 0),
      0
    );

    return total / leads.length;
  }

  private static groupBySource(
    leads: Lead[]
  ): { name: string; count: number }[] {
    const groups: Record<string, number> = {};

    for (const lead of leads) {
      const source = lead.source || 'Unknown';
      groups[source] = (groups[source] || 0) + 1;
    }

    return Object.entries(groups)
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private static groupByStatus(
    leads: Lead[]
  ): { name: string; count: number }[] {
    const groups: Record<string, number> = {};

    for (const lead of leads) {
      const status = lead.status || 'Unknown';
      groups[status] = (groups[status] || 0) + 1;
    }

    return Object.entries(groups)
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private static getTopCompanies(
    leads: Lead[]
  ): { company: string; count: number }[] {
    const groups: Record<string, number> = {};

    for (const lead of leads) {
      const company = lead.company || 'Unknown';
      groups[company] = (groups[company] || 0) + 1;
    }

    return Object.entries(groups)
      .map(([company, count]) => ({
        company,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private static getScoreDistribution(
    leads: Lead[]
  ): { range: string; count: number }[] {
    const distribution = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0,
    };

    for (const lead of leads) {
      const score = typeof lead.score === 'number' ? lead.score : 0;

      if (score <= 20) {
        distribution['0-20']++;
      } else if (score <= 40) {
        distribution['21-40']++;
      } else if (score <= 60) {
        distribution['41-60']++;
      } else if (score <= 80) {
        distribution['61-80']++;
      } else {
        distribution['81-100']++;
      }
    }

    return Object.entries(distribution).map(([range, count]) => ({
      range,
      count,
    }));
  }
}