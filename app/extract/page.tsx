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

interface Results {
  totalExtracted: number;
  gmailsGenerated: number;
  validGmails: number;
  savedLeads: number;
  company: string;
  leads: Lead[];
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
  const [cik, setCik] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState('');

  const handleExtract = async () => {
    if (!cik.trim()) {
      setError('Please enter a CIK number');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const response = await fetch('/api/sec/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cik: cik.trim(),
          filingType: '10-K',
          generateCount: 20,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Extraction failed');
      }

      setResults(data);

      if (!data.leads?.length) {
        setError(
          'Executives found but no valid Gmail candidates were saved. Try another CIK.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!results?.leads?.length) return;

    const headers = ['Name', 'Title', 'Company', 'Email', 'Score', 'Status'];
    const rows = results.leads.map((l) => [
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
    a.download = `leads_${results.company || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Extract Leads</h1>
        <p className="page-subtitle">
          Pull executives from SEC EDGAR filings and generate Gmail candidates
        </p>
      </div>

      <div className="card mb-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label">CIK Number</label>
            <input
              type="text"
              value={cik}
              onChange={(e) => setCik(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
              placeholder="e.g. 0000320193"
              className="input"
            />
          </div>
          <button
            type="button"
            onClick={handleExtract}
            disabled={loading}
            className="btn-primary min-w-[140px]"
          >
            {loading ? 'Extracting…' : 'Extract'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="mr-1 self-center text-xs text-slate-400">Quick:</span>
          {QUICK_CIKS.map((item) => (
            <button
              key={item.cik}
              type="button"
              onClick={() => setCik(item.cik)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {results && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Executives" value={results.totalExtracted} />
            <Stat label="Gmails generated" value={results.gmailsGenerated} />
            <Stat label="Valid Gmails" value={results.validGmails} />
            <Stat label="Saved leads" value={results.savedLeads} />
          </div>

          {results.leads?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {results.company}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {results.leads.length} verified Gmail leads
                  </p>
                </div>
                <button type="button" onClick={exportCsv} className="btn-secondary">
                  Export CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-3">Name</th>
                      <th className="px-6 py-3">Title</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Score</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3.5 font-medium text-slate-900">
                          {lead.name}
                        </td>
                        <td className="px-6 py-3.5 text-slate-600">{lead.title}</td>
                        <td className="px-6 py-3.5">
                          <a
                            href={`mailto:${lead.email}`}
                            className="font-mono text-sm text-indigo-600 hover:underline"
                          >
                            {lead.email}
                          </a>
                        </td>
                        <td className="px-6 py-3.5">
                          <ScoreBadge score={lead.score} />
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="badge bg-emerald-50 text-emerald-700">
                            {lead.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!results && !loading && !error && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <h3 className="text-sm font-semibold text-slate-900">Ready to extract</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Enter a company CIK or pick a quick example above.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-emerald-50 text-emerald-700'
      : score >= 60
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-600';

  return <span className={`badge ${color}`}>{score}</span>;
}
