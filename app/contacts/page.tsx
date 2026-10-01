'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Contact = {
  email: string;
  name: string | null;
  sendCount: number;
  lastSentAt: string;
  lastSubject: string;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickN, setPickN] = useState(50);

  // Campaign compose
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [textBody, setTextBody] = useState('');
  const [sendAsHtml, setSendAsHtml] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      params.set('limit', '3000');
      const res = await fetch('/api/contacts?' + params.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setContacts(data.contacts || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load contacts');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const allEmails = useMemo(() => contacts.map((c) => c.email), [contacts]);

  const toggle = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(allEmails));
  const clearSelection = () => setSelected(new Set());

  const selectFirstN = (n: number) => {
    const take = Math.max(1, Math.min(n, contacts.length));
    setSelected(new Set(contacts.slice(0, take).map((c) => c.email)));
  };

  const selectedList = useMemo(
    () => contacts.filter((c) => selected.has(c.email)),
    [contacts, selected]
  );

  const sendToSelected = async (dryRun = false) => {
    setSending(true);
    setError('');
    setResult(null);
    try {
      if (selected.size === 0) {
        throw new Error('Select at least one contact');
      }
      if (!subject.trim()) throw new Error('Subject is required');
      const bodyToSend = sendAsHtml ? htmlBody : textBody;
      if (!bodyToSend.trim()) {
        throw new Error(
          sendAsHtml ? 'HTML body is required' : 'Plain text body is required'
        );
      }

      const to = selectedList
        .map((c) =>
          c.name ? `${c.name} <${c.email}>` : c.email
        )
        .join('\n');

      const res = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'manual',
          to,
          subject,
          body: bodyToSend,
          html: sendAsHtml,
          htmlBody: htmlBody.trim() || undefined,
          textBody: textBody.trim() || undefined,
          limit: Math.min(selected.size, 500),
          dryRun,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setResult(data);
      if (!dryRun && data.sent > 0) {
        // Refresh so lastSentAt / counts update
        setTimeout(() => load(), 800);
      }
    } catch (e: any) {
      setError(e.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const exportSelected = () => {
    const text = selectedList.map((c) => c.email).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${selected.size}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">
            People you already emailed successfully — pick them for the next
            campaign without retyping addresses
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/campaigns" className="btn-secondary">
            Campaigns
          </Link>
          <Link href="/inbox" className="btn-secondary">
            Sent inbox
          </Link>
          <button type="button" className="btn-secondary" onClick={() => load()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-white">{contacts.length}</div>
          <div className="text-xs text-white/45">Unique contacts</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-fuchsia-300">{selected.size}</div>
          <div className="text-xs text-white/45">Selected</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-emerald-300">
            {contacts.reduce((s, c) => s + c.sendCount, 0)}
          </div>
          <div className="text-xs text-white/45">Total successful sends</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-cyan-300">
            {contacts.filter((c) => c.sendCount > 1).length}
          </div>
          <div className="text-xs text-white/45">Emailed more than once</div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search email or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <button type="button" className="btn-secondary" onClick={selectAll}>
          Select all
        </button>
        <button type="button" className="btn-secondary" onClick={clearSelection}>
          Clear
        </button>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={500}
            className="input w-20"
            value={pickN}
            onChange={(e) => setPickN(Number(e.target.value) || 50)}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => selectFirstN(pickN)}
          >
            Select first {pickN}
          </button>
        </div>
        <button
          type="button"
          className="btn-ghost text-xs"
          disabled={selected.size === 0}
          onClick={exportSelected}
        >
          Export selected .txt
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card overflow-hidden lg:col-span-3">
          {loading ? (
            <div className="p-6 text-sm text-white/50">Loading contacts…</div>
          ) : contacts.length === 0 ? (
            <div className="p-6 text-sm text-white/50">
              No successful sends yet. After you send from{' '}
              <Link href="/campaigns" className="text-fuchsia-300 underline">
                Campaigns
              </Link>
              , recipients appear here automatically.
            </div>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#1a0f2e] text-xs uppercase text-white/45">
                  <tr>
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={
                          contacts.length > 0 &&
                          selected.size === contacts.length
                        }
                        onChange={(e) =>
                          e.target.checked ? selectAll() : clearSelection()
                        }
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Sends</th>
                    <th className="px-3 py-2">Last sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {contacts.map((c) => (
                    <tr
                      key={c.email}
                      className={
                        'cursor-pointer hover:bg-white/5 ' +
                        (selected.has(c.email) ? 'bg-fuchsia-500/10' : '')
                      }
                      onClick={() => toggle(c.email)}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(c.email)}
                          onChange={() => toggle(c.email)}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-fuchsia-200">
                        {c.email}
                      </td>
                      <td className="px-3 py-2 text-white/70">{c.name || '—'}</td>
                      <td className="px-3 py-2 text-xs text-white/60">{c.sendCount}</td>
                      <td className="px-3 py-2 text-xs text-white/45 whitespace-nowrap">
                        {new Date(c.lastSentAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card space-y-4 p-5 lg:col-span-2">
          <h3 className="font-semibold text-white">
            Email selected ({selected.size})
          </h3>
          <p className="text-xs text-white/45">
            Uses the same SMTP campaign sender. Successful sends are logged
            again to Sent inbox and stay on this list.
          </p>

          <div>
            <label className="label">Subject</label>
            <input
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject ({{name}} supported)"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={sendAsHtml}
              onChange={(e) => setSendAsHtml(e.target.checked)}
            />
            Prefer HTML
          </label>

          <div>
            <label className="label">Plain text</label>
            <textarea
              className="input min-h-[100px] resize-y font-mono text-xs"
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              placeholder="Hi {{name}}, …"
            />
          </div>

          <div>
            <label className="label">HTML body</label>
            <textarea
              className="input min-h-[120px] resize-y font-mono text-xs"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              placeholder="<div>Hi {{name}}…</div>"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={sending || selected.size === 0}
              onClick={() => sendToSelected(true)}
            >
              Preview
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={sending || selected.size === 0}
              onClick={() => sendToSelected(false)}
            >
              {sending
                ? 'Sending…'
                : `Send to ${selected.size || 0} contact${selected.size === 1 ? '' : 's'}`}
            </button>
          </div>

          {selected.size > 0 ? (
            <div className="max-h-28 overflow-auto rounded-lg bg-black/30 p-2 font-mono text-[11px] text-white/50">
              {selectedList
                .slice(0, 30)
                .map((c) => c.email)
                .join(', ')}
              {selectedList.length > 30
                ? ` … +${selectedList.length - 30} more`
                : ''}
            </div>
          ) : null}

          {result ? (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white/70">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}
