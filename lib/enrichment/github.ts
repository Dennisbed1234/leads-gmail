/**
 * GitHub public email enrichment using the official REST API only.
 * - Profile email (only if user made it public)
 * - Public events / commit author emails when exposed
 * Requires GITHUB_TOKEN for higher rate limits (optional but recommended).
 */

export type GitHubEmailHit = {
  email: string;
  name?: string;
  username: string;
  source: 'profile' | 'commit' | 'event';
  profileUrl: string;
  score: number;
};

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': process.env.SEC_USER_AGENT || 'LeadBot-Pro',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

function isUsableEmail(email: string): boolean {
  const e = email.toLowerCase().trim();
  if (!/^[^
	 @]+@[^
	 @]+
?.[^
	 @]+$/.test(e)) return false;
  // Skip GitHub noreply / bot noise
  if (e.includes('users.noreply.github.com')) return false;
  if (e.includes('noreply')) return false;
  if (e.endsWith('.local')) return false;
  return true;
}

export async function searchGitHubUsers(
  query: string,
  limit = 10
): Promise<{ login: string; html_url: string; score: number }[]> {
  const url = `https://api.github.com/search/users?q=${encodeURIComponent(
    query
  )}&per_page=${Math.min(limit, 20)}`;

  const res = await fetch(url, { headers: headers(), cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub search failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.items || []).map((u: any) => ({
    login: u.login,
    html_url: u.html_url,
    score: u.score,
  }));
}

export async function getUserPublicEmail(
  username: string
): Promise<GitHubEmailHit | null> {
  const res = await fetch(`https://api.github.com/users/${username}`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const user = await res.json();

  if (user.email && isUsableEmail(user.email)) {
    return {
      email: user.email.toLowerCase(),
      name: user.name || undefined,
      username: user.login,
      source: 'profile',
      profileUrl: user.html_url,
      score: 90,
    };
  }
  return null;
}

/** Pull author emails from recent public events when present */
export async function getEmailsFromPublicEvents(
  username: string
): Promise<GitHubEmailHit[]> {
  const res = await fetch(
    `https://api.github.com/users/${username}/events/public?per_page=30`,
    { headers: headers(), cache: 'no-store' }
  );
  if (!res.ok) return [];

  const events = await res.json();
  const hits: GitHubEmailHit[] = [];
  const seen = new Set<string>();

  for (const ev of events) {
    const commits = ev?.payload?.commits || [];
    for (const c of commits) {
      const email = c?.author?.email;
      const name = c?.author?.name;
      if (email && isUsableEmail(email) && !seen.has(email.toLowerCase())) {
        seen.add(email.toLowerCase());
        hits.push({
          email: email.toLowerCase(),
          name: name || undefined,
          username,
          source: 'event',
          profileUrl: `https://github.com/${username}`,
          score: 70,
        });
      }
    }
  }
  return hits;
}

/**
 * Find public emails related to a person name / company query.
 * Returns only emails GitHub already exposes publicly.
 */
export async function enrichFromGitHub(
  query: string,
  options?: { maxUsers?: number }
): Promise<GitHubEmailHit[]> {
  const maxUsers = options?.maxUsers ?? 8;
  const users = await searchGitHubUsers(query, maxUsers);
  const results: GitHubEmailHit[] = [];
  const seen = new Set<string>();

  for (const u of users) {
    try {
      const profile = await getUserPublicEmail(u.login);
      if (profile && !seen.has(profile.email)) {
        seen.add(profile.email);
        results.push(profile);
      }

      const fromEvents = await getEmailsFromPublicEvents(u.login);
      for (const hit of fromEvents) {
        if (!seen.has(hit.email)) {
          seen.add(hit.email);
          results.push(hit);
        }
      }
    } catch {
      // continue next user
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
