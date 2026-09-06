'use client';

import { useState } from 'react';

export default function CampaignsPage() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;

    setSending(true);
    setDone(false);
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    setDone(true);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Campaigns</h1>
        <p className="page-subtitle">
          Compose and send outreach to your verified leads
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="space-y-5">
            <div>
              <label className="label">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Quick idea for {{company}}…"
                className="input"
              />
            </div>

            <div>
              <label className="label">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={'Hi {{name}},\n\nI noticed…'}
                rows={10}
                className="input resize-y"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Use {'{{name}}'} and {'{{company}}'} for personalization when sending is wired.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !subject.trim() || !body.trim()}
                className="btn-primary"
              >
                {sending ? 'Sending…' : 'Send campaign'}
              </button>

              {done && (
                <span className="text-sm text-emerald-600">
                  Campaign queued (demo)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-sm font-medium text-slate-900">SMTP required</p>
            <p className="mt-1 text-xs text-slate-500">
              Configure SMTP_* env vars on Vercel to enable real sending.
            </p>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900">Tips</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Keep subjects short and specific</li>
              <li>• Personalize with name + company</li>
              <li>• Start with a small test batch</li>
              <li>• Respect CAN-SPAM / GDPR rules</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
