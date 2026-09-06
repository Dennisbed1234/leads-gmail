'use client';

import { useEffect, useMemo, useState } from 'react';

export default function CampaignsPage() {
  const [mode, setMode] = useState<'manual' | 'leads'>('manual');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('Quick idea for {{company}}');
  const [body, setBody] = useState(
    'Hi {{name}},\n\nI came across {{company}} and wanted to share a quick idea...\n\nBest regards'
  );
  const [limit, setLimit] = useState(20);
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

  const parsedCount = useMemo(() => {
    if (!to.trim()) return 0;
    return to
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes('@')).length;
  }, [to]);

  const send = async (dryRun = false) => {
    setSending(true);
    setError('');
    setResult(null);
    try {
      if (mode === 'manual' && !to.trim()) {
        throw new Error('Add at least one email in the To field');
      }

      const res = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          to: mode === 'manual' ? to : undefined,
          subject,
          body,
          limit,
          status: 'NEW',
          dryRun,
        }),
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
          Send to specific emails or to saved leads via Gmail SMTP
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
            SMTP not configured. Set SMTP_USER and SMTP_PASS (Gmail App Password)
            on Vercel.
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

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          className={mode === 'manual' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setMode('manual')}
        >
          Manual recipients
        </button>
        <button
          type="button"
          className={mode === 'leads' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setMode('leads')}
        >
          From saved leads
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-5 p-6 lg:col-span-2">
          {mode === 'manual' ? (
            <div>
              <label className="label">
                To{' '}
                <span className="font-normal text-slate-400">
                  ({parsedCount} address{parsedCount === 1 ? '' : 'es'})
                </span>
              </label>
              <textarea
                className="input min-h-[120px] resize-y font-mono text-sm"
                placeholder={
                  'one@example.com\ntwo@example.com\nJane Doe <jane@acme.com>'
                }
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                One email per line, or separate with commas. Optional format:{' '}
                <code className="rounded bg-slate-100 px-1">
                  {'Name <email@domain.com>'}
                </code>
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Will send to up to <strong>{limit}</strong> leads with status{' '}
              <strong>NEW</strong> from your database.
            </div>
          )}

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
              Tokens:{' '}
              <code className="rounded bg-slate-100 px-1">{'{{name}}'}</code>{' '}
              <code className="rounded bg-slate-100 px-1">{'{{company}}'}</code>{' '}
              <code className="rounded bg-slate-100 px-1">{'{{email}}'}</code>{' '}
              <code className="rounded bg-slate-100 px-1">{'{{title}}'}</code>
            </p>
          </div>

          <div>
            <label className="label">Max recipients this send</label>
            <input
              type="number"
              min={1}
              max={50}
              className="input max-w-[160px]"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={sending}
              onClick={() => send(true)}
            >
              Preview
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={sending}
              onClick={() => send(false)}
            >
              {sending
                ? 'Sending…'
                : mode === 'manual'
                  ? 'Send to recipients'
                  : 'Send to leads'}
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
            <h3 className="text-sm font-semibold text-slate-900">How To works</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Paste many emails at once</li>
              <li>New line or comma separated</li>
              <li>Each person gets their own email (not one group To)</li>
              <li>About 2 seconds between sends (Gmail-friendly)</li>
            </ul>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900">Limits</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Max 50 recipients per click</li>
              <li>Gmail daily caps apply (about 100 to 500)</li>
              <li>Use Preview before real sends</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
