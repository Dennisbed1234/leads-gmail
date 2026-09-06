'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Loader2, TrendingUp, Users, Building2 } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  company?: string;
  score: number;
  status: string;
  source?: string;
}

export default function AnalyticsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leads')
      .then((res) => res.json())
      .then((data) => {
        setLeads(data.leads || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const avgScore = useMemo(() => {
    if (!leads.length) return 0;
    return Math.round(
      leads.reduce((acc, l) => acc + (l.score || 0), 0) / leads.length
    );
  }, [leads]);

  const uniqueCompanies = useMemo(
    () => new Set(leads.map((l) => l.company).filter(Boolean)).size,
    [leads]
  );

  const scoreBuckets = useMemo(() => {
    const buckets = [
      { range: '0–49', count: 0 },
      { range: '50–69', count: 0 },
      { range: '70–84', count: 0 },
      { range: '85–100', count: 0 },
    ];

    for (const l of leads) {
      const s = l.score || 0;
      if (s < 50) buckets[0].count++;
      else if (s < 70) buckets[1].count++;
      else if (s < 85) buckets[2].count++;
      else buckets[3].count++;
    }

    return buckets;
  }, [leads]);

  const topCompanies = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leads) {
      const key = l.company || 'Unknown';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [leads]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-32 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" />
        Loading analytics…
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">
          Score distribution and company coverage
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2.5 text-primary-600">
              <Users size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total leads</p>
              <p className="text-2xl font-semibold text-slate-900">{leads.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Average score</p>
              <p className="text-2xl font-semibold text-slate-900">{avgScore}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-50 p-2.5 text-violet-600">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Companies</p>
              <p className="text-2xl font-semibold text-slate-900">
                {uniqueCompanies}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Score distribution
          </h2>
          {leads.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No data yet</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Top companies
          </h2>
          {topCompanies.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topCompanies.map((c) => {
                const max = topCompanies[0]?.count || 1;
                const pct = Math.round((c.count / max) * 100);
                return (
                  <div key={c.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate text-slate-700">{c.name}</span>
                      <span className="font-medium text-slate-900">{c.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
