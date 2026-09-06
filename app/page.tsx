'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  totalLeads: number;
  uniqueCompanies: number;
  sources: { name: string; count: number }[];
  statuses: { name: string; count: number }[];
  averageScore: { _avg: { score: number | null } };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: 'Total Leads',
      value: stats?.totalLeads ?? '—',
      accent: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'Companies',
      value: stats?.uniqueCompanies ?? '—',
      accent: 'bg-violet-50 text-violet-600',
    },
    {
      label: 'Avg Score',
      value: stats?.averageScore?._avg?.score
        ? Math.round(stats.averageScore._avg.score)
        : '—',
      accent: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Sources',
      value: stats?.sources?.length ?? '—',
      accent: 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div>
      <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Overview of your lead generation pipeline
          </p>
        </div>
        <Link href="/extract" className="btn-primary">
          Extract Leads
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="card p-5">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              {loading ? (
                <span className="inline-block h-8 w-12 animate-pulse rounded bg-slate-100" />
              ) : (
                card.value
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
          <div className="mt-4 space-y-2">
            <Link
              href="/extract"
              className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50"
            >
              Run SEC extract
              <span className="text-slate-400">→</span>
            </Link>
            <Link
              href="/leads"
              className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50"
            >
              Browse all leads
              <span className="text-slate-400">→</span>
            </Link>
            <Link
              href="/campaigns"
              className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50"
            >
              Start a campaign
              <span className="text-slate-400">→</span>
            </Link>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">Lead status</h2>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ) : stats?.statuses?.length ? (
              stats.statuses.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-600">{s.name}</span>
                  <span className="font-medium text-slate-900">{s.count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No leads yet</p>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">Sources</h2>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ) : stats?.sources?.length ? (
              stats.sources.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate text-slate-600">{s.name}</span>
                  <span className="font-medium text-slate-900">{s.count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No sources yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
