'use client';

import { useState, useEffect } from 'react';

export default function Analytics() {
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/leads')
      .then(res => res.json())
      .then(data => setLeads(data.leads || []));
  }, []);

  const total = leads.length;
  const avgScore = total > 0 
    ? Math.round(leads.reduce((acc, l) => acc + l.score, 0) / total)
    : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">📈 Analytics</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="text-3xl font-bold text-blue-600">{total}</div>
          <div className="text-sm text-gray-600">Total Leads</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="text-3xl font-bold text-green-600">{avgScore}</div>
          <div className="text-sm text-gray-600">Average Score</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Lead List</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {leads.slice(0, 20).map((lead) => (
            <div key={lead.id} className="flex justify-between items-center py-2 border-b border-gray-100">
              <div>
                <div className="font-medium">{lead.name}</div>
                <div className="text-sm text-gray-500">{lead.company}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">{lead.email}</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  {lead.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}