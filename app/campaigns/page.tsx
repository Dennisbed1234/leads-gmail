'use client';

import { useEffect, useState } from 'react';

export default function CampaignsPage() {
  const [subject, setSubject] = useState('Quick idea for {{company}}');
  const [body, setBody] = useState(
    'Hi {{name}},\n\nI came across {{company}} and wanted to share a quick idea...\n\nBest regards'
  );
  const [limit, setLimit] = useState(10);
  const [testTo, setTestTo] = useState('');
  const [sending, setSending] = useState(false);
  const [smtp, setSmtp] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/campaign')
      .then((r) => r.json())
      .then(setSmtp)
      .catch(() => setSmtp({ configured: false }));
  }, []);

  const send = async (opts: { test?: boolean; dryRun?: boolean }) => {
    setSending(true);
    setError('');
    setResult(null);
    try {
      const payload: any = {
        subject,
        body,
        limit,
        status: 'NEW',
        dryRun: Boolean(opts.dryRun),
      };
      if (opts.test) {
        if (!testTo.trim()) {
          throw new Error('Enter a test email address');
        }
        payload.testTo = testTo.trim();
      }

      const res = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Campaigns</h1>
        <p className="page-subtitle">
          Send personalized email via your Gmail SMTP
        </p>
      </div>

      <div
        className={
          'mb-6 rounded-xl border px-4 py-3 text-sm ' +
          (smtp?.verified
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : smtp?.configured
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-red-200 bg-red-50 text-red-800')
        }
      >
        {!smtp && 'Checking SMTP…'}
        {smtp && !smtp.configured && (
          <>
            SMTP not configured. Set{' '}
            <code className="rounded bg-white/60 px-1">SMTP_USER</code> and{' '}
            <code className="rounded bg-white/60 px-1">SMTP_PASS</code> (Gmail App
            Password) on Vercel.
          </>
        )}
        {smtp?.configured && smtp.verified && (
          <>
            SMTP connected as <strong>{smtp.user}</strong> — ready to send.
          </>
        )}
        {smtp?.configured && !smtp.verified && (
          <>
            Credentials present but verify failed:{' '}
            {smtp.error || 'check App Password / 2FA'}.
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-5 p-6 lg:col-span-2">
          <div>
            <label className="label">Subject</label>
            <input
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Body</label>
            <textarea
              className="input resize-y"
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Tokens: {'{{name}}'} {'{{company}}'} {'{{email}}'} {'{{title}}'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Max leads to contact</label>
              <input
                type="number"
                min={1}
                max={50}
                className="input"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Test email (send only to you)</label>
              <input
                className="input"
                placeholder="you@gmail.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={sending}
              onClick={() => send({ dryRun: true })}
            >
              Preview (dry run)
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={sending}
              onClick={() => send({ test: true })}
            >
              Send test
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={sending}
              onClick={() => send({})}
            >
              {sending ? 'Sending…' : 'Send to leads'}
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900">Gmail setup</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-slate-600">
              <li>Enable 2-Step Verification</li>
              <li>Create a Google App Password</li>
              <li>
                Vercel env:
                <div className="mt-1 font-mono text-xs leading-relaxed">
                  SMTP_HOST=smtp.gmail.com
                  <br />
                  SMTP_PORT=587
                  <br />
                  SMTP_USER=you@gmail.com
                  <br />
                  SMTP_PASS=your-app-password
                  <br />
                  SMTP_FROM=you@gmail.com
                </div>
              </li>
              <li>Redeploy after saving env vars</li>
            </ol>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900">Limits</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>• ~100–500 sends/day on consumer Gmail</li>
              <li>• Max 50 per request, 2s apart</li>
              <li>• Always send a test first</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
