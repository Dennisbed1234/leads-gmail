'use client';

import { useEffect, useMemo, useState } from 'react';

interface Lead {
  id: string;
  name: string;
  title?: string;
  company?: string;
  email?: string;
  status: string;
  score: number;
  source?: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    fetch('/api/leads')
      .then((res) => res.json())
      .then((data) => {
        setLeads(data.leads || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchesQuery =
        !query ||
        [l.name, l.email, l.company, l.title]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' || l.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [leads, query, statusFilter]);

  const statuses = useMemo(
    () => ['ALL', ...Array.from(new Set(leads.map((l) => l.status)))],
    [leads]
  );

  const exportCsv = () => {
    if (!filtered.length) return;

    const headers = ['Name', 'Title', 'Company', 'Email', 'Score', 'Status', 'Source'];
    const rows = filtered.map((l) => [
      l.name,
      l.title || '',
      l.company || '',
      l.email || '',
      l.score,
      l.status,
      l.source || '',
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
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
      <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${filtered.length} of ${leads.length} leads`}
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="btn-secondary"
          disabled={!filtered.length}
        >
          Export CSV
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, company…"
          className="input flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-full sm:w-40"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All statuses' : s}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-500">Loading leads…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm font-medium text-slate-900">No leads found</p>
            <p className="mt-1 text-sm text-slate-500">
              {leads.length === 0
                ? 'Extract some leads first from the Extract page.'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Company</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Score</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3.5 font-medium text-slate-900">
                      {lead.name}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">
                      {lead.title || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">
                      {lead.company || '—'}
                    </td>
                    <td className="px-6 py-3.5">
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          className="font-mono text-sm text-indigo-600 hover:underline"
                        >
                          {lead.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <ScoreBadge score={lead.score} />
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="badge bg-slate-100 text-slate-700">
                        {lead.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
