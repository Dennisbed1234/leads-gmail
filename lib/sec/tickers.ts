export type TickerEntry = {
  cik: string;
  ticker: string;
  title: string;
};

let cache: TickerEntry[] | null = null;
let cacheAt = 0;
const CACHE_MS = 1000 * 60 * 60 * 6; // 6 hours

/**
 * Loads SEC company_tickers.json (~10k+ public companies).
 * https://www.sec.gov/files/company_tickers.json
 */
export async function loadCompanyTickers(
  userAgent: string
): Promise<TickerEntry[]> {
  if (cache && Date.now() - cacheAt < CACHE_MS) {
    return cache;
  }

  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/json',
    },
    next: { revalidate: 21600 },
  });

  if (!res.ok) {
    throw new Error(`Failed to load SEC tickers: ${res.status}`);
  }

  const data = await res.json();
  // Shape: { "0": { cik_str, ticker, title }, "1": ... }
  const entries: TickerEntry[] = Object.values(data).map((row: any) => ({
    cik: String(row.cik_str).padStart(10, '0'),
    ticker: String(row.ticker || '').toUpperCase(),
    title: String(row.title || ''),
  }));

  cache = entries;
  cacheAt = Date.now();
  return entries;
}

export async function searchTickers(
  userAgent: string,
  query: string,
  limit = 25
): Promise<TickerEntry[]> {
  const all = await loadCompanyTickers(userAgent);
  const q = query.trim().toLowerCase();

  if (!q) return all.slice(0, limit);

  const scored = all
    .map((e) => {
      const ticker = e.ticker.toLowerCase();
      const title = e.title.toLowerCase();
      let score = 0;
      if (ticker === q) score = 100;
      else if (ticker.startsWith(q)) score = 80;
      else if (title.startsWith(q)) score = 70;
      else if (title.includes(q)) score = 50;
      else if (e.cik.includes(q.replace(/\D/g, ''))) score = 40;
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);

  return scored;
}

/** Pick N companies for bulk runs (by index stride for diversity) */
export async function sampleCompanies(
  userAgent: string,
  count: number,
  offset = 0
): Promise<TickerEntry[]> {
  const all = await loadCompanyTickers(userAgent);
  const out: TickerEntry[] = [];
  for (let i = offset; i < all.length && out.length < count; i++) {
    out.push(all[i]);
  }
  return out;
}
