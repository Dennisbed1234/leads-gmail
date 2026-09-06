'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  TrendingUp,
  Mail,
  ArrowRight,
  Search,
  Activity,
} from 'lucide-react';

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
      icon: Users,
      color: 'text-primary-600 bg-primary-50',
    },
    {
      label: 'Companies',
      value: stats?.uniqueCompanies ?? '—',
      icon: Building2,
      color: 'text-violet-600 bg-violet-50',
    },
    {
      label: 'Avg Score',
      value: stats?.averageScore?._avg?.score
        ? Math.round(stats.averageScore._avg.score)
        : '—',
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Sources',
      value: stats?.sources?.length ?? '—',
      icon: Activity,
      color: 'text-amber-600 bg-amber-50',
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
          <Search size={16} />
          Extract Leads
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
                  {loading ? (
                    <span className="inline-block h-8 w-12 animate-pulse rounded bg-slate-100" />
                  ) : (
                    card.value
                  )}
                </p>
              </div>
              <div className={`rounded-lg p-2.5 ${card.color}`}>
                <card.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick actions */}
        <div className="card p-6 lg:col-span-1">
          <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
          <div className="mt-4 space-y-2">
            <Link
              href="/extract"
              className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-primary-200 hover:bg-primary-50/50"
            >
              <span className="flex items-center gap-2">
                <Search size={16} className="text-primary-600" />
                Run SEC extract
              </span>
              <ArrowRight size={16} className="text-slate-400" />
            </Link>
            <Link
              href="/leads"
              className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-primary-200 hover:bg-primary-50/50"
            >
              <span className="flex items-center gap-2">
                <Users size={16} className="text-primary-600" />
                Browse all leads
              </span>
              <ArrowRight size={16} className="text-slate-400" />
            </Link>
            <Link
              href="/campaigns"
              className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-primary-200 hover:bg-primary-50/50"
            >
              <span className="flex items-center gap-2">
                <Mail size={16} className="text-primary-600" />
                Start a campaign
              </span>
              <ArrowRight size={16} className="text-slate-400" />
            </Link>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="card p-6 lg:col-span-1">
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

        {/* Sources */}
        <div className="card p-6 lg:col-span-1">
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
