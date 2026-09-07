'use client';

import { useMemo, useState } from 'react';

type ExtractedEmail = {
  email: string;
  domain: string;
  local: string;
  isGmail: boolean;
};

export default function EmailExtractPage() {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [gmailOnly, setGmailOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emails, setEmails] = useState<ExtractedEmail[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    gmailCount: number;
    otherCount: number;
  } | null>(null);

  const filtered = useMemo(() => {
    if (!gmailOnly) return emails;
    return emails.filter((e) => e.isGmail);
  }, [emails, gmailOnly]);

  const onFile = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];
    if (file.size > 2 * 1024 * 1024) {
      setError('File max 2MB');
      return;
    }
    setFileName(file.name);
    setError('');
    try {
      const content = await file.text();
      setText(content);
    } catch {
      setError('Could not read file as text');
    }
  };

  const extract = async () => {
    if (!text.trim()) {
      setError('Paste text or upload a file first');
      return;
    }
    setLoading(true);
    setError('');
    setEmails([]);
    setStats(null);
    try {
      const res = await fetch('/api/extract-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          gmailOnly: false, // filter client-side for toggle
          unique: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extract failed');
      setEmails(data.emails || []);
      setStats({
        total: data.total || 0,
        gmailCount: data.gmailCount || 0,
        otherCount: data.otherCount || 0,
      });
    } catch (e: any) {
      setError(e.message || 'Extract failed');
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    const list = filtered.map((e) => e.email).join('\n');
    await navigator.clipboard.writeText(list);
  };

  const downloadCsv = () => {
    const header = 'email,domain,local,is_gmail';
    const rows = filtered.map(
      (e) =>
        `${e.email},${e.domain},${e.local},${e.isGmail ? 'yes' : 'no'}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted_emails.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTxt = () => {
    const list = filtered.map((e) => e.email).join('\n');
    const blob = new Blob([list], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted_emails.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Email Extractor</h1>
        <p className="page-subtitle">
          Pull emails from pasted text or a raw file (.txt, .csv, .html, logs…)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-5 p-6 lg:col-span-2">
          <div>
            <label className="label">Upload file (optional)</label>
            <input
              type="file"
              accept=".txt,.csv,.html,.htm,.json,.log,.md,.xml,.eml,text/*"
              className="block w-full text-sm text-white/70"
              onChange={(e) => onFile(e.target.files)}
            />
            {fileName ? (
              <p className="mt-1 text-xs text-white/45">Loaded: {fileName}</p>
            ) : null}
          </div>

          <div>
            <label className="label">Raw text</label>
            <textarea
              className="input min-h-[220px] resize-y font-mono text-xs"
              placeholder="Paste HTML, CSV, logs, or any text containing emails…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-white/40">
              Also handles obfuscated forms like name [at] domain [dot] com
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={gmailOnly}
                onChange={(e) => setGmailOnly(e.target.checked)}
              />
              Show Gmail only
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={loading}
              onClick={extract}
            >
              {loading ? 'Extracting…' : 'Extract emails'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setText('');
                setFileName('');
                setEmails([]);
                setStats(null);
                setError('');
              }}
            >
              Clear
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {stats ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center">
                <div className="text-2xl font-semibold text-white">
                  {stats.total}
                </div>
                <div className="text-xs text-white/45">Unique emails</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center">
                <div className="text-2xl font-semibold text-white">
                  {stats.gmailCount}
                </div>
                <div className="text-xs text-white/45">Gmail</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center">
                <div className="text-2xl font-semibold text-white">
                  {stats.otherCount}
                </div>
                <div className="text-xs text-white/45">Other domains</div>
              </div>
            </div>
          ) : null}

          {filtered.length > 0 ? (
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={copyAll}>
                  Copy all
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={downloadTxt}>
                  Download .txt
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={downloadCsv}>
                  Download .csv
                </button>
                <span className="self-center text-xs text-white/40">
                  Showing {filtered.length}
                </span>
              </div>
              <div className="max-h-[420px] overflow-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#1a0f2e] text-xs uppercase text-white/45">
                    <tr>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Domain</th>
                      <th className="px-4 py-2">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((e) => (
                      <tr key={e.email}>
                        <td className="px-4 py-2 font-mono text-xs text-fuchsia-200">
                          {e.email}
                        </td>
                        <td className="px-4 py-2 text-white/60">{e.domain}</td>
                        <td className="px-4 py-2 text-xs">
                          {e.isGmail ? (
                            <span className="text-emerald-300">Gmail</span>
                          ) : (
                            <span className="text-white/40">Other</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white">Supported</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/55">
              <li>Paste any raw text</li>
              <li>.txt .csv .html .json .log .md</li>
              <li>Obfuscated: name [at] x [dot] com</li>
              <li>Deduped unique list</li>
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white">Tips</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/55">
              <li>Max ~2MB per extract</li>
              <li>noreply@ addresses are skipped</li>
              <li>Export CSV then use Campaigns</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
