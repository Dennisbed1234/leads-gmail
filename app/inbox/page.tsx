'use client';

import { useCallback, useEffect, useState } from 'react';

type SentItem = {
  id: string;
  toEmail: string;
  toName?: string | null;
  subject: string;
  bodySnippet?: string | null;
  status: string;
  messageId?: string | null;
  error?: string | null;
  mode?: string | null;
  isHtml?: boolean;
  fromName?: string | null;
  createdAt: string;
  deliveredAt?: string | null;
  openedAt?: string | null;
  openCount?: number | null;
  lastEvent?: string | null;
};

function statusLabel(item: SentItem) {
  const s = (item.status || '').toUpperCase();
  const ev = (item.lastEvent || '').toLowerCase();
  if (s === 'FAILED' || ev === 'failed') return { text: 'Failed', className: 'text-rose-300' };
  if (s === 'OPENED' || ev === 'opened' || ev === 'clicked')
    return { text: 'Opened', className: 'text-sky-300' };
  if (s === 'DELIVERED' || ev === 'delivered')
    return { text: 'Delivered', className: 'text-emerald-300' };
  return { text: 'Sent', className: 'text-white/70' };
}

export default function InboxPage() {
  const [items, setItems] = useState<SentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<
    'all' | 'SENT' | 'DELIVERED' | 'OPENED' | 'FAILED'
  >('all');
  const [q, setQ] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    sentCount: 0,
    failedCount: 0,
    deliveredCount: 0,
    openedCount: 0,
  });
  const [selected, setSelected] = useState<SentItem | null>(null);
  const [note, setNote] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      params.set('limit', '200');

      const res = await fetch('/api/inbox?' + params.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems(data.items || []);
      setStats({
        total: data.total || 0,
        sentCount: data.sentCount || 0,
        failedCount: data.failedCount || 0,
        deliveredCount: data.deliveredCount || 0,
        openedCount: data.openedCount || 0,
      });
      setNote(data.note || '');
      setNeedsSetup(Boolean(data.needsSetup));
    } catch (e: any) {
      setError(e.message || 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const createTable = async () => {
    setSetupLoading(true);
    setError('');
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create table failed');
      setNeedsSetup(false);
      setNote(data.message || 'Table ready');
      await load();
    } catch (e: any) {
      setError(e.message || 'Create table failed');
    } finally {
      setSetupLoading(false);
    }
  };

  const removeOne = async (id: string) => {
    try {
      const res = await fetch('/api/inbox', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      if (selected?.id === id) setSelected(null);
      load();
    } catch (e: any) {
      setError(e.message || 'Delete failed');
    }
  };

  const clearAll = async () => {
    if (!confirm('Clear entire sent log?')) return;
    try {
      const res = await fetch('/api/inbox', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Clear failed');
      setSelected(null);
      load();
    } catch (e: any) {
      setError(e.message || 'Clear failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Sent inbox</h1>
          <p className="page-subtitle">
            Sent → Delivered → Opened
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => load()}>
            Refresh
          </button>
          <button type="button" className="btn-ghost text-rose-300" onClick={clearAll}>
            Clear log
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-white">{stats.total}</div>
          <div className="text-xs text-white/45">Total</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-white/80">{stats.sentCount}</div>
          <div className="text-xs text-white/45">Sent</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-emerald-300">
            {stats.deliveredCount}
          </div>
          <div className="text-xs text-white/45">Delivered</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-sky-300">{stats.openedCount}</div>
          <div className="text-xs text-white/45">Opened</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-rose-300">{stats.failedCount}</div>
          <div className="text-xs text-white/45">Failed</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'SENT', 'DELIVERED', 'OPENED', 'FAILED'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={status === s ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setStatus(s)}
          >
            {s === 'all'
              ? 'All'
              : s === 'SENT'
                ? 'Sent'
                : s === 'DELIVERED'
                  ? 'Delivered'
                  : s === 'OPENED'
                    ? 'Opened'
                    : 'Failed'}
          </button>
        ))}
        <input
          className="input max-w-xs"
          placeholder="Search email or subject…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
      </div>

      {note ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {note}
        </div>
      ) : null}

      {needsSetup ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
          <p className="mb-3">Database table for Sent inbox is missing. Create it once:</p>
          <button
            type="button"
            className="btn-primary"
            disabled={setupLoading}
            onClick={createTable}
          >
            {setupLoading ? 'Creating table…' : 'Create SentEmail table'}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card overflow-hidden lg:col-span-3">
          {loading ? (
            <div className="p-6 text-sm text-white/50">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-white/50">
              No sent messages yet. Run a campaign and they will appear here.
            </div>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#1a0f2e] text-xs uppercase text-white/45">
                  <tr>
                    <th className="px-4 py-2">When</th>
                    <th className="px-4 py-2">To</th>
                    <th className="px-4 py-2">Subject</th>
                    <th className="px-4 py-2">Event</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((item) => {
                    const st = statusLabel(item);
                    return (
                      <tr
                        key={item.id}
                        className={
                          'cursor-pointer hover:bg-white/5 ' +
                          (selected?.id === item.id ? 'bg-fuchsia-500/10' : '')
                        }
                        onClick={() => setSelected(item)}
                      >
                        <td className="whitespace-nowrap px-4 py-2 text-xs text-white/45">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-fuchsia-200">
                          {item.toEmail}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-2 text-white/80">
                          {item.subject}
                        </td>
                        <td className={`px-4 py-2 text-xs font-medium ${st.className}`}>
                          {st.text}
                          {item.openCount && item.openCount > 0
                            ? ` · ${item.openCount}`
                            : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-5 lg:col-span-2">
          {selected ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-white">Message</h3>
                <button
                  type="button"
                  className="text-xs text-rose-300"
                  onClick={() => removeOne(selected.id)}
                >
                  Delete
                </button>
              </div>
              <Row label="Status" value={statusLabel(selected).text} />
              {selected.lastEvent ? (
                <Row label="Last event" value={selected.lastEvent} />
              ) : null}
              <Row label="From" value={selected.fromName || 'CryptoByt'} />
              <Row label="To" value={selected.toEmail} />
              {selected.toName ? <Row label="Name" value={selected.toName} /> : null}
              <Row label="Subject" value={selected.subject} />
              <Row
                label="When"
                value={new Date(selected.createdAt).toLocaleString()}
              />
              {selected.openedAt ? (
                <Row
                  label="Opened at"
                  value={new Date(selected.openedAt).toLocaleString()}
                />
              ) : null}
              {selected.openCount ? (
                <Row label="Open count" value={String(selected.openCount)} />
              ) : null}
              {selected.mode ? <Row label="Mode" value={selected.mode} /> : null}
              {selected.messageId ? (
                <Row label="Message-ID" value={selected.messageId} />
              ) : null}
              {selected.error ? (
                <div>
                  <div className="text-xs text-white/45">Error</div>
                  <div className="mt-1 rounded-lg bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
                    {selected.error}
                  </div>
                </div>
              ) : null}
              {selected.bodySnippet ? (
                <div>
                  <div className="text-xs text-white/45">Snippet</div>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 text-xs text-white/70">
                    {selected.bodySnippet}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-white/45">Select a row to view details</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-white/45">{label}</div>
      <div className="break-all text-white/85">{value}</div>
    </div>
  );
}
