'use client';

import { useState } from 'react';

interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  status: string;
  score: number;
}

const QUICK_CIKS = [
  { name: 'Apple', cik: '0000320193' },
  { name: 'Microsoft', cik: '0000789019' },
  { name: 'Amazon', cik: '0001018724' },
  { name: 'Alphabet', cik: '0001652044' },
  { name: 'Tesla', cik: '0001318605' },
  { name: 'Meta', cik: '0001326801' },
  { name: 'NVIDIA', cik: '0001045810' },
];

export default function ExtractPage() {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [cik, setCik] = useState('');
  const [companyCount, setCompanyCount] = useState(25);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<any>(null);

  const runSingle = async () => {
    if (!cik.trim()) {
      setError('Enter a CIK');
      return;
    }
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const res = await fetch('/api/sec/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cik: cik.trim(), generateCount: 25 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResults({ type: 'single', ...data });
    } catch (e: any) {
      setError(e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const runBulk = async () => {
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const res = await fetch('/api/sec/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyCount,
          offset,
          includeGmail: true,
          includeCorporate: true,
          maxExecsPerCompany: 12,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk failed');
      setResults({ type: 'bulk', ...data });
    } catch (e: any) {
      setError(e.message || 'Bulk failed');
    } finally {
      setLoading(false);
    }
  };

  const leads: Lead[] = results?.leads || results?.sampleLeads || [];

  const exportCsv = () => {
    if (!leads.length) return;
    const headers = ['Name', 'Title', 'Company', 'Email', 'Score', 'Status'];
    const rows = leads.map((l) => [
      l.name,
      l.title,
      l.company,
      l.email,
      l.score,
      l.status,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Extract Leads</h1>
        <p className="page-subtitle">
          Single company or bulk batch from SEC (scale to 1k–5k/day via multiple batches)
        </p>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={mode === 'single' ? 'btn-primary' : 'btn-secondary'}
        >
          Single CIK
        </button>
        <button
          type="button"
          onClick={() => setMode('bulk')}
          className={mode === 'bulk' ? 'btn-primary' : 'btn-secondary'}
        >
          Bulk batch
        </button>
      </div>

      <div className="card mb-6 p-6">
        {mode === 'single' ? (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="label">CIK Number</label>
                <input
                  className="input"
                  value={cik}
                  onChange={(e) => setCik(e.target.value)}
                  placeholder="e.g. 0000320193"
                  onKeyDown={(e) => e.key === 'Enter' && runSingle()}
                />
              </div>
              <button
                type="button"
                className="btn-primary min-w-[140px]"
                disabled={loading}
                onClick={runSingle}
              >
                {loading ? 'Extracting…' : 'Extract'}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="self-center text-xs text-slate-400">Quick:</span>
              {QUICK_CIKS.map((item) => (
                <button
                  key={item.cik}
                  type="button"
                  onClick={() => setCik(item.cik)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-indigo-300"
                >
                  {item.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600">
              Processes public SEC companies in batches. Run several times/day with
              increasing <strong>offset</strong> (0 → 25 → 50 → …) to scale toward
              thousands of leads. Respects SEC rate limits.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Companies per batch</label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  className="input"
                  value={companyCount}
                  onChange={(e) => setCompanyCount(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">Offset (next page)</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={offset}
                  onChange={(e) => setOffset(Number(e.target.value))}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={loading}
                  onClick={runBulk}
                >
                  {loading ? 'Running batch…' : 'Run bulk batch'}
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Example: 40 batches × 25 companies ≈ 1,000 companies/day. Each
              company yields multiple email candidates (Gmail + corporate patterns).
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {results && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {results.type === 'bulk' ? (
            <>
              <Stat label="Companies" value={results.companiesProcessed} />
              <Stat label="Executives" value={results.executivesFound} />
              <Stat label="Candidates" value={results.candidatesGenerated} />
              <Stat label="Saved leads" value={results.leadsSaved} />
            </>
          ) : (
            <>
              <Stat label="Executives" value={results.totalExtracted} />
              <Stat label="Candidates" value={results.gmailsGenerated} />
              <Stat label="Saved" value={results.savedLeads} />
              <Stat label="Filing" value={results.filingUsed || '—'} />
            </>
          )}
        </div>
      )}

      {results?.tip && (
        <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          {results.tip}
        </div>
      )}

      {leads.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {results?.company || 'Sample leads'} ({leads.length})
            </h2>
            <button type="button" className="btn-secondary" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Company</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.id + String(lead.email)}>
                    <td className="px-6 py-3 font-medium">{lead.name}</td>
                    <td className="px-6 py-3 text-slate-600">{lead.title}</td>
                    <td className="px-6 py-3 text-slate-600">{lead.company}</td>
                    <td className="px-6 py-3 font-mono text-sm text-indigo-600">
                      {lead.email}
                    </td>
                    <td className="px-6 py-3">{lead.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
