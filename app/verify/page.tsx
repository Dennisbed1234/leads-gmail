'use client';

import { useEffect, useState } from 'react';

export default function VerifyPage() {
  const [meta, setMeta] = useState<any>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/verify/email')
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => null);
  }, []);

  const run = async (mode: 'list' | 'leads') => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      let body: any;
      if (mode === 'leads') {
        body = { fromLeads: true, limit: 25, save: true };
      } else {
        const emails = input
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter((s) => s.includes('@'));
        if (emails.length === 0) {
          throw new Error('Enter at least one email');
        }
        body =
          emails.length === 1
            ? { email: emails[0], save: true }
            : { emails, save: true };
      }

      const res = await fetch('/api/verify/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Verify failed');
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Verify failed');
    } finally {
      setLoading(false);
    }
  };

  const results = data?.result
    ? [data.result]
    : data?.results || [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Verify</h1>
        <p className="page-subtitle">
          Check syntax, MX records, disposable domains, and optional paid inbox status
        </p>
      </div>

      <div
        className={
          'mb-6 rounded-xl border px-4 py-3 text-sm ' +
          (meta?.paidVerifier
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-amber-200 bg-amber-50 text-amber-900')
        }
      >
        {meta?.note || 'Loading verifier status…'}
      </div>

      <div className="card space-y-4 p-6">
        <div>
          <label className="label">Emails to verify</label>
          <textarea
            className="input min-h-[140px] resize-y font-mono text-sm"
            placeholder="one@company.com\ntwo@company.com"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={loading}
            onClick={() => run('list')}
          >
            {loading ? 'Verifying…' : 'Verify list'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading}
            onClick={() => run('leads')}
          >
            Verify recent leads
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {data?.summary && (
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
              Valid: {data.summary.valid}
            </span>
            <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
              Invalid: {data.summary.invalid}
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">
              Risky / unknown: {data.summary.risky}
            </span>
          </div>
        )}

        {results.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">MX</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r: any) => (
                  <tr key={r.email}>
                    <td className="px-4 py-3 font-mono text-indigo-600">
                      {r.email}
                    </td>
                    <td className="px-4 py-3">{r.status}</td>
                    <td className="px-4 py-3">{r.score}</td>
                    <td className="px-4 py-3">
                      {r.checks?.mx ? 'yes' : 'no'}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs text-slate-500">
                      {r.reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 card p-5 text-sm text-slate-600">
        <h3 className="font-semibold text-slate-900">How verification works</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Free:</strong> syntax, MX records, disposable domains, role
            addresses (info@, sales@).
          </li>
          <li>
            <strong>Inbox confirmed:</strong> set{' '}
            <code className="rounded bg-slate-100 px-1">ZEROBOUNCE_API_KEY</code> on
            Vercel (paid). Free mode cannot prove a mailbox exists.
          </li>
          <li>
            Vercel blocks outbound port 25, so classic SMTP "RCPT TO" probes do not
            work in production.
          </li>
        </ul>
      </div>
    </div>
  );
}
