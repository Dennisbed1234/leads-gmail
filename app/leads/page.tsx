'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Download, Users, Loader2 } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  title?: string;
  company?: string;
  email?: string;
  status: string;
  score: number;
  source?: string;
  createdAt?: string;
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
          .some((v) =>
            String(v).toLowerCase().includes(query.toLowerCase())
          );

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
        <button onClick={exportCsv} className="btn-secondary" disabled={!filtered.length}>
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, company…"
            className="input pl-9"
          />
        </div>
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
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Loading leads…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Users size={22} className="text-slate-400" />
            </div>
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
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-medium uppercase tracking-wider text-slate-500">
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
                          className="font-mono text-sm text-primary-600 hover:underline"
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
