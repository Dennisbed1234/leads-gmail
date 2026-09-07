'use client';

import { useEffect, useMemo, useState } from 'react';

type Attachment = {
  filename: string;
  content: string;
  contentType?: string;
};

const DEFAULT_HTML = [
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0f0720;color:#f8fafc;border-radius:16px">',
  '<div style="height:6px;border-radius:999px;background:linear-gradient(90deg,#f43f5e,#a855f7,#22d3ee);margin-bottom:20px"></div>',
  '<h1 style="font-size:22px;margin:0 0 12px">Hi {{name}},</h1>',
  '<p style="line-height:1.6;color:#e2e8f0">I came across <strong>{{company}}</strong> and wanted to share a quick idea.</p>',
  '<p style="line-height:1.6;color:#e2e8f0">Happy to send a short overview if useful.</p>',
  '<p style="margin-top:24px;color:#cbd5e1">Best regards</p>',
  '</div>',
].join('');

const DEFAULT_TEXT = [
  'Hi {{name}},',
  '',
  'I came across {{company}} and wanted to share a quick idea.',
  '',
  'Happy to send a short overview if useful.',
  '',
  'Best regards',
].join('\n');

function fillTokens(template: string) {
  return template
    .split('{{name}}').join('Alex')
    .split('{{company}}').join('Acme')
    .split('{{email}}').join('alex@acme.com')
    .split('{{title}}').join('CEO');
}

export default function CampaignsPage() {
  const [mode, setMode] = useState<'manual' | 'leads'>('manual');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('Quick idea for {{company}}');
  const [htmlBody, setHtmlBody] = useState(DEFAULT_HTML);
  const [textBody, setTextBody] = useState(DEFAULT_TEXT);
  const [sendAsHtml, setSendAsHtml] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
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

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const next: Attachment[] = [...attachments];

    for (const file of Array.from(files).slice(0, 5 - next.length)) {
      if (file.size > 4 * 1024 * 1024) {
        setError('File ' + file.name + ' is over 4MB');
        continue;
      }
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      next.push({
        filename: file.name,
        content: btoa(binary),
        contentType: file.type || undefined,
      });
    }

    setAttachments(next.slice(0, 5));
  };

  const send = async (dryRun = false) => {
    setSending(true);
    setError('');
    setResult(null);
    try {
      if (mode === 'manual' && !to.trim()) {
        throw new Error('Add at least one email in the To field');
      }

      const bodyToSend = sendAsHtml ? htmlBody : textBody;
      if (!bodyToSend.trim()) {
        throw new Error(sendAsHtml ? 'HTML body is required' : 'Plain text body is required');
      }

      const res = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          to: mode === 'manual' ? to : undefined,
          subject,
          body: bodyToSend,
          html: sendAsHtml,
          // also send both so server can prefer HTML + text multipart when both exist
          htmlBody: htmlBody.trim() || undefined,
          textBody: textBody.trim() || undefined,
          attachments,
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
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Campaigns</h1>
        <p className="page-subtitle">
          Separate HTML + plain text, live preview, attachments, Gmail SMTP
        </p>
      </div>

      <div
        className={
          'rounded-2xl border px-4 py-3 text-sm ' +
          (smtp?.verified
            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
            : smtp?.configured
              ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
              : 'border-rose-400/30 bg-rose-500/10 text-rose-100')
        }
      >
        {!smtp && 'Checking SMTP...'}
        {smtp && !smtp.configured && (
          <span>SMTP not configured. Set SMTP_USER and SMTP_PASS on Vercel.</span>
        )}
        {smtp?.configured && smtp.verified && (
          <span>
            SMTP connected as <strong>{smtp.user}</strong> — ready to send HTML +
            files.
          </span>
        )}
        {smtp?.configured && !smtp.verified && (
          <span>Verify failed: {smtp.error || 'check App Password / 2FA'}.</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
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
                To ({parsedCount} addresses)
              </label>
              <textarea
                className="input min-h-[100px] resize-y font-mono text-sm"
                placeholder={'one@example.com\ntwo@example.com'}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              Sends to up to <strong className="text-white">{limit}</strong> leads
              with status <strong className="text-white">NEW</strong>.
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

          {/* Send format + preview toggles */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={sendAsHtml}
                onChange={(e) => setSendAsHtml(e.target.checked)}
              />
              Prefer HTML when sending
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={showPreview}
                onChange={(e) => setShowPreview(e.target.checked)}
              />
              Show HTML preview
            </label>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => {
                setHtmlBody(DEFAULT_HTML);
                setTextBody(DEFAULT_TEXT);
              }}
            >
              Load sample templates
            </button>
          </div>

          {/* Two-column: Plain text | HTML */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label">Plain text body</label>
              <textarea
                className="input min-h-[240px] resize-y font-mono text-xs"
                rows={14}
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                placeholder="Plain text version of the email..."
              />
              <p className="mt-1.5 text-xs text-white/40">
                Used as fallback / when HTML is off. Tokens: {'{{name}}'}, {'{{company}}'}, {'{{email}}'}, {'{{title}}'}
              </p>
            </div>

            <div>
              <label className="label">HTML body</label>
              <textarea
                className="input min-h-[240px] resize-y font-mono text-xs"
                rows={14}
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                placeholder="<div>HTML email...</div>"
              />
              <p className="mt-1.5 text-xs text-white/40">
                Inline CSS recommended. Same tokens work inside HTML.
              </p>
            </div>
          </div>

          {/* Toggleable live HTML preview */}
          {showPreview && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="label mb-0">HTML preview</label>
                <span className="text-xs text-white/40">Sample: Alex @ Acme</span>
              </div>
              <div
                className="overflow-auto rounded-xl border border-white/10 bg-black/40 p-4"
                style={{ minHeight: 160, maxHeight: 420 }}
                dangerouslySetInnerHTML={{ __html: fillTokens(htmlBody) }}
              />
            </div>
          )}

          <div>
            <label className="label">Attachments (max 5, 4MB each)</label>
            <input
              type="file"
              multiple
              className="block w-full text-sm text-white/70"
              onChange={(e) => onFiles(e.target.files)}
            />
            {attachments.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-white/60">
                {attachments.map((a) => (
                  <li
                    key={a.filename}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>{a.filename}</span>
                    <button
                      type="button"
                      className="text-rose-300"
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((x) => x.filename !== a.filename)
                        )
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <label className="label">Max recipients</label>
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
              Preview send
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={sending}
              onClick={() => send(false)}
            >
              {sending ? 'Sending...' : 'Send emails'}
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80">
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white">How it works</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/55">
              <li>Left: plain text body</li>
              <li>Right: HTML body (side-by-side)</li>
              <li>Toggle "Show HTML preview" for live render</li>
              <li>"Prefer HTML" decides which version is primary</li>
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white">HTML tips</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/55">
              <li>Use inline CSS for email clients</li>
              <li>Keep width around 560–600px</li>
              <li>Tokens work in both text and HTML</li>
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white">Files</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/55">
              <li>PDF, images, docs supported</li>
              <li>Total payload under ~8MB</li>
              <li>Same files go to every recipient</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
