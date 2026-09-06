'use client';

import { useState } from 'react';

export default function EnrichPage() {
  const [ghQuery, setGhQuery] = useState('');
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState<'github' | 'web' | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const runGitHub = async () => {
    if (!ghQuery.trim()) return;
    setLoading('github');
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/enrich/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ghQuery.trim(), save: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResult({ type: 'github', ...data });
    } catch (e: any) {
      setError(e.message || 'GitHub enrichment failed');
    } finally {
      setLoading(null);
    }
  };

  const runWebsite = async () => {
    if (!domain.trim()) return;
    setLoading('web');
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/enrich/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim(), save: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResult({ type: 'website', ...data });
    } catch (e: any) {
      setError(e.message || 'Website enrichment failed');
    } finally {
      setLoading(null);
    }
  };

  const hits = result?.hits || [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Enrich</h1>
        <p className="page-subtitle">
          Pull publicly listed emails from GitHub and company contact pages
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Only public data is used (GitHub API + contact pages you specify). This is
        not a general web scraper. Respect privacy laws and site terms when
        outreaching.
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* GitHub */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">GitHub</h2>
          <p className="mt-1 text-xs text-slate-500">
            Search users and collect profile/public-event emails when exposed.
          </p>
          <div className="mt-4 space-y-3">
            <input
              className="input"
              placeholder="Name, company, or username"
              value={ghQuery}
              onChange={(e) => setGhQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runGitHub()}
            />
            <button
              type="button"
              className="btn-primary w-full"
              disabled={!!loading}
              onClick={runGitHub}
            >
              {loading === 'github' ? 'Searching GitHub…' : 'Find GitHub emails'}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Optional: set <code className="rounded bg-slate-100 px-1">GITHUB_TOKEN</code> on
            Vercel for higher rate limits.
          </p>
        </div>

        {/* Website */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">Company website</h2>
          <p className="mt-1 text-xs text-slate-500">
            Scan /contact, /about, /team on a domain you provide.
          </p>
          <div className="mt-4 space-y-3">
            <input
              className="input"
              placeholder="acme.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runWebsite()}
            />
            <button
              type="button"
              className="btn-primary w-full"
              disabled={!!loading}
              onClick={runWebsite}
            >
              {loading === 'web' ? 'Scanning pages…' : 'Extract contact emails'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 card overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Found {result.found} · Saved {result.saved}
            </h3>
            {result.tip && (
              <p className="mt-1 text-xs text-slate-500">{result.tip}</p>
            )}
          </div>
          {hits.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">
              No public emails found for this query.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Name / user</th>
                    <th className="px-6 py-3">Source</th>
                    <th className="px-6 py-3">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hits.map((h: any) => (
                    <tr key={h.email}>
                      <td className="px-6 py-3 font-mono text-indigo-600">
                        {h.email}
                      </td>
                      <td className="px-6 py-3 text-slate-700">
                        {h.name || h.username || '—'}
                      </td>
                      <td className="px-6 py-3 text-slate-500">
                        {h.source || h.pageUrl || '—'}
                      </td>
                      <td className="px-6 py-3">{h.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
