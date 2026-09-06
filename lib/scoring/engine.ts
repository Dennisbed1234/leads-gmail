export class ScoringEngine {
  static calculateLeadScore(lead: any): number {
    let score = 50;

    // Title bonus
    if (lead.title) {
      const titleBonuses: Record<string, number> = {
        'CEO': 30,
        'CFO': 28,
        'CTO': 28,
        'COO': 27,
        'President': 25,
        'VP': 20,
        'Director': 15,
        'Manager': 10,
      };

      for (const [title, bonus] of Object.entries(titleBonuses)) {
        if (lead.title.includes(title)) {
          score += bonus;
          break;
        }
      }
    }

    // Source bonus
    if (lead.source === 'SEC EDGAR') {
      score += 10;
    }

    // Email verification bonus
    if (lead.email && lead.email.includes('@gmail.com')) {
      score += 5;
    }

    return Math.min(score, 100);
  }

  static getTier(score: number): { label: string; color: string } {
    if (score >= 80) return { label: 'Hot', color: '#16a34a' };
    if (score >= 60) return { label: 'Warm', color: '#d97706' };
    if (score >= 40) return { label: 'Cool', color: '#6366f1' };
    return { label: 'Cold', color: '#94a3b8' };
  }
}