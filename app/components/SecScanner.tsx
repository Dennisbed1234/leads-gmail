'use client';

import { useState } from 'react';

export default function SecScanner() {
  const [cik, setCik] = useState('');
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('');

  const handleScan = async () => {
    if (!cik) {
      setError('Please enter a CIK number');
      return;
    }

    setLoading(true);
    setError('');
    setLeads([]);

    try {
      const response = await fetch('/api/sec/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cik, filingType: '10-K', generateCount: 20 })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Scan failed');
      }

      const data = await response.json();
      setLeads(data.leads || []);
      setCompanyName(data.company);
      
      if (data.leads.length === 0) {
        setError('No valid Gmail addresses found for executives');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-2">📧 SEC EDGAR + Gmail Generator</h2>
        <p className="text-gray-600 mb-6">
          Extract executives from SEC filings and generate their real Gmail addresses
        </p>

        <div className="flex gap-4 mb-6">
          <input
            type="text"
            value={cik}
            onChange={(e) => setCik(e.target.value)}
            placeholder="Enter CIK (e.g., 0000320193)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleScan}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Scanning...' : '🔍 Extract Gmails'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {leads.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {companyName} - {leads.length} Valid Gmails Found
              </h3>
              <button
                onClick={() => {
                  const headers = ['Name', 'Title', 'Company', 'Gmail', 'Score'];
                  const rows = leads.map((l: any) => 
                    [l.name, l.title, l.company, l.email, l.score]
                  );
                  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `gmails_${companyName}.csv`;
                  a.click();
                }}
                className="px-3 py-1 bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100"
              >
                📥 Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Gmail</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map((lead) => (
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
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          lead.score >= 80 ? 'bg-green-100 text-green-800' :
                          lead.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {lead.score}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Quick CIK References */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 mb-2">Popular CIKs to try:</p>
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
              {name} ({cik})
            </button>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 <strong>How it works:</strong> Extracts executives from SEC filings → Generates Gmail variations → Verifies in real-time → Saves only working emails
        </p>
      </div>
    </div>
  );
}