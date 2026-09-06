'use client';

import { useState } from 'react';

export default function GmailLeadGenerator() {
  const [cik, setCik] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!cik) {
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
          cik, 
          filingType: '10-K',
          generateCount: 20 // Generate up to 20 executive Gmails
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Generation failed');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-2">
          📧 Gmail Lead Generator (10k+ daily)
        </h2>
        <p className="text-gray-600 mb-6">
          Extract executives from SEC filings and generate their real Gmail addresses
        </p>

        {/* Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CIK Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cik}
                onChange={(e) => setCik(e.target.value)}
                placeholder="e.g. 0000320193 (Apple)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Generating...' : '🚀 Generate Gmails'}
              </button>
            </div>
          </div>
          <div className="flex items-center text-sm text-gray-500">
            ⚡ Up to 10,000 Gmails/day
          </div>
        </div>

        {/* Quick CIKs */}
        <div className="mb-6 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">Quick try:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { name: 'Apple', cik: '0000320193' },
              { name: 'Microsoft', cik: '0000789019' },
              { name: 'Amazon', cik: '0001018724' },
              { name: 'Google', cik: '0001652044' },
              { name: 'Tesla', cik: '0001318605' }
            ].map(({ name, cik }) => (
              <button
                key={cik}
                onClick={() => setCik(cik)}
                className="px-3 py-1 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard label="Executives Found" value={results.totalExtracted} color="blue" />
              <StatCard label="Gmails Generated" value={results.gmailsGenerated} color="purple" />
              <StatCard label="Verified Gmails" value={results.validGmails} color="green" />
              <StatCard label="Saved Leads" value={results.savedLeads} color="gold" />
            </div>

            {/* Leads Table */}
            {results.leads.length > 0 && (
              <div className="overflow-x-auto">
                <h3 className="text-lg font-semibold mb-3">Valid Gmail Leads</h3>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Gmail</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.leads.map((lead: any) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{lead.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{lead.title}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{lead.company}</td>
                        <td className="px-4 py-3 text-sm text-green-600 font-mono">
                          <a href={`mailto:${lead.email}`} className="hover:underline">
                            {lead.email}
                          </a>
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                            ✓ Verified
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            {lead.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Export Button */}
            {results.leads.length > 0 && (
              <button
                onClick={() => {
                  const headers = ['Name', 'Title', 'Company', 'Gmail', 'Score'];
                  const rows = results.leads.map((l: any) => 
                    [l.name, l.title, l.company, l.email, l.score]
                  );
                  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `gmails_${results.company}.csv`;
                  a.click();
                }}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                📥 Export All Gmails to CSV
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-1">💡 How it works:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>1️⃣ Extracts executive names from SEC EDGAR (100% free)</li>
          <li>2️⃣ Generates 10+ Gmail variations per executive</li>
          <li>3️⃣ Verifies each Gmail address in real-time</li>
          <li>4️⃣ Saves only verified, working Gmails</li>
          <li>⚡ Can generate 10,000+ verified Gmails daily</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: any) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    gold: 'bg-yellow-50 text-yellow-600'
  };

  return (
    <div className={`p-4 rounded-lg ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  );
}