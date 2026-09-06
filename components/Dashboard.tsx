'use client';

import { useState, useEffect } from 'react';

interface Stats {
  totalLeads: number;
  uniqueCompanies: number;
  sources: { name: string; count: number }[];
  statuses: { name: string; count: number }[];
  averageScore: { _avg: { score: number | null } };
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="p-6 text-center text-gray-500">No data available</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">📊 Dashboard</h2>
      
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="text-3xl font-bold text-blue-600">{stats.totalLeads}</div>
          <div className="text-sm text-gray-600">Total Leads</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="text-3xl font-bold text-purple-600">{stats.uniqueCompanies}</div>
          <div className="text-sm text-gray-600">Companies</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="text-3xl font-bold text-green-600">{stats.sources.length}</div>
          <div className="text-sm text-gray-600">Sources</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="text-3xl font-bold text-yellow-600">
            {stats.averageScore._avg.score?.toFixed(0) || 0}
          </div>
          <div className="text-sm text-gray-600">Avg Score</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-semibold mb-3">Lead Sources</h3>
          {stats.sources.map((source) => (
            <div key={source.name} className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-sm">{source.name}</span>
              <span className="text-sm font-semibold">{source.count}</span>
            </div>
          ))}
        </div>

        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-semibold mb-3">Lead Status</h3>
          {stats.statuses.map((status) => (
            <div key={status.name} className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-sm">{status.name}</span>
              <span className="text-sm font-semibold">{status.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}