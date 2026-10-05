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

type InboxItem = {
  toEmail: string;
  status: string;
  lastEvent?: string | null;
  openCount?: number | null;
  createdAt: string;
};

export default function LeadsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [latestStatus, setLatestStatus] = useState<
    Map<string, { status: string; openCount: number }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cRes, iRes] = await Promise.all([
        fetch('/api/contacts?limit=10000'),
        fetch('/api/inbox?limit=20000'),
      ]);
      const cData = await cRes.json();
      const iData = await iRes.json();
      if (!cRes.ok) throw new Error(cData.error || 'Failed to load contacts');

      setContacts(cData.contacts || []);

      // Latest event per email from sent inbox
      const map = new Map<string, { status: string; openCount: number }>();
      const items: InboxItem[] = iData.items || [];
      // items are newest first
      for (const item of items) {
        const email = (item.toEmail || '').toLowerCase().trim();
        if (!email || map.has(email)) continue;
        map.set(email, {
          status: (item.status || 'SENT').toUpperCase(),
          openCount: item.openCount || 0,
        });
      }
      setLatestStatus(map);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enriched = useMemo(() => {
    return contacts.map((c) => {
      const st = latestStatus.get(c.email.toLowerCase());
      return {
        ...c,
        event: st?.status || 'SENT',
        openCount: st?.openCount || 0,
      };
    });
  }, [contacts, latestStatus]);

  const filtered = useMemo(() => {
    return enriched.filter((l) => {
      const matchesQuery =
        !query ||
        [l.email, l.name, l.lastSubject]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' ||
        l.event === statusFilter ||
        (statusFilter === 'SENT' &&
          ['SENT', 'DELIVERED', 'OPENED'].includes(l.event));

      return matchesQuery && matchesStatus;
    });
  }, [enriched, query, statusFilter]);

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = [
      'Email',
      'Name',
      'Send count',
      'Last sent',
      'Last subject',
      'Status',
      'Opens',
    ];
    const rows = filtered.map((l) => [
      l.email,
      l.name || '',
      l.sendCount,
      l.lastSentAt,
      l.lastSubject || '',
      l.event,
      l.openCount,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recipients_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const eventClass = (s: string) => {
    if (s === 'OPENED') return 'text-sky-300';
    if (s === 'FAILED') return 'text-rose-300';
    if (s === 'DELIVERED') return 'text-emerald-300';
    return 'text-white/70';
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">
            Unique recipients from Sent inbox
            {!loading
              ? ` · ${filtered.length.toLocaleString()} of ${contacts.length.toLocaleString()}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/contacts" className="btn-secondary">
            Contacts
          </Link>
          <Link href="/inbox" className="btn-secondary">
            Sent inbox
          </Link>
          <button type="button" className="btn-secondary" onClick={load}>
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="btn-secondary"
            disabled={!filtered.length}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-white">{contacts.length}</div>
          <div className="text-xs text-white/45">Unique recipients</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-sky-300">
            {enriched.filter((e) => e.event === 'OPENED').length}
          </div>
          <div className="text-xs text-white/45">Opened</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-emerald-300">
            {
              enriched.filter((e) =>
                ['DELIVERED', 'OPENED', 'SENT'].includes(e.event)
              ).length
            }
          </div>
          <div className="text-xs text-white/45">Reached</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-fuchsia-300">
            {filtered.length}
          </div>
          <div className="text-xs text-white/45">Showing</div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search email, name, subject…"
          className="input flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-full sm:w-44"
        >
          <option value="ALL">All statuses</option>
          <option value="OPENED">Opened</option>
          <option value="DELIVERED">Delivered</option>
          <option value="SENT">Sent / reached</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-white/50">Loading recipients…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-white/50">
            {contacts.length === 0
              ? 'No recipients yet. Send campaigns and they appear here from the Sent inbox.'
              : 'No matches for this search or filter.'}
          </div>
        ) : (
          <div className="max-h-[min(80vh,900px)] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#1a0f2e] text-xs uppercase text-white/45">
                <tr>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Sends</th>
                  <th className="px-4 py-2">Last subject</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Last sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((lead) => (
                  <tr key={lead.email} className="hover:bg-white/5">
                    <td className="px-4 py-2 font-mono text-xs text-fuchsia-200">
                      {lead.email}
                    </td>
                    <td className="px-4 py-2 text-white/80">{lead.name || '—'}</td>
                    <td className="px-4 py-2 text-white/70">{lead.sendCount}</td>
                    <td className="max-w-[180px] truncate px-4 py-2 text-white/60">
                      {lead.lastSubject || '—'}
                    </td>
                    <td className={`px-4 py-2 text-xs font-medium ${eventClass(lead.event)}`}>
                      {lead.event}
                      {lead.openCount > 0 ? ` · ${lead.openCount}` : ''}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-white/45">
                      {new Date(lead.lastSentAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
