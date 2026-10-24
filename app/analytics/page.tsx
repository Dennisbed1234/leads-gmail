'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Totals = {
  total: number;
  sent: number;
  smtpAccepted?: number;
  failed: number;
  bounced?: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed?: number;
  today: number;
  last7: number;
  uniqueContacts: number;
  openRate: number;
  clickRate: number;
  failRate: number;
  unsubRate?: number;
};

type DayRow = {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced?: number;
  unsubscribed?: number;
};
type DomainRow = { name: string; count: number };
type CampaignRow = { id: string; count: number };

export default function AnalyticsPage() {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [byDay, setByDay] = useState<DayRow[]>([]);
  const [topDomains, setTopDomains] = useState<DomainRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (camp?: string) => {
    setLoading(true);
    setError('');
    try {
      const q = camp ? `?campaignId=${encodeURIComponent(camp)}` : '';
      const res = await fetch(`/api/analytics${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setTotals(data.totals || null);
      setByDay(data.byDay || []);
      setTopDomains(data.topDomains || []);
      setCampaigns(data.campaigns || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(campaignId || undefined);
  }, [load, campaignId]);

  const maxDay = Math.max(
    1,
    ...byDay.map((d) => d.sent + d.failed + (d.bounced || 0))
  );

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">
            SMTP accepted · opens · clicks · bounces · unsubscribes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/inbox" className="btn-secondary">
            Sent inbox
          </Link>
          <Link href="/contacts" className="btn-secondary">
            Contacts
          </Link>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => load(campaignId || undefined)}
          >
            Refresh
          </button>
        </div>
      </div>

      {campaigns.length > 0 ? (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <label className="text-sm text-white/60">Campaign</label>
          <select
            className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} ({c.count})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {loading && !totals ? (
        <p className="text-sm text-white/50">Loading analytics…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Total logged" value={totals?.total ?? 0} />
            <Stat
              label="SMTP accepted"
              value={totals?.smtpAccepted ?? totals?.sent ?? 0}
              tone="ok"
            />
            <Stat label="Opened" value={totals?.opened ?? 0} tone="sky" />
            <Stat label="Clicked" value={totals?.clicked ?? 0} tone="violet" />
            <Stat label="Failed" value={totals?.failed ?? 0} tone="bad" />
            <Stat label="Bounced" value={totals?.bounced ?? 0} tone="bad" />
            <Stat
              label="Unsubscribed"
              value={totals?.unsubscribed ?? 0}
              tone="bad"
            />
            <Stat label="Open rate" value={`${totals?.openRate ?? 0}%`} tone="sky" />
            <Stat
              label="Click rate"
              value={`${totals?.clickRate ?? 0}%`}
              tone="violet"
            />
            <Stat
              label="Unsub rate"
              value={`${totals?.unsubRate ?? 0}%`}
              tone="bad"
            />
            <Stat label="Unique contacts" value={totals?.uniqueContacts ?? 0} />
          </div>

          <p className="text-xs text-white/40">
            SMTP accepted means the provider took the message — not that it
            reached the Primary inbox. True spam complaints need an ESP
            feedback loop (Resend / SES).
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <Stat label="Sent today (24h)" value={totals?.today ?? 0} />
            <Stat label="Sent last 7 days" value={totals?.last7 ?? 0} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-4 text-sm font-semibold text-white">
                Volume · last 7 days
              </h2>
              {byDay.every(
                (d) => d.sent === 0 && d.failed === 0 && !(d.bounced || 0)
              ) ? (
                <p className="py-10 text-center text-sm text-white/40">
                  No sends in the last 7 days
                </p>
              ) : (
                <div className="space-y-3">
                  {byDay.map((d) => (
                    <div key={d.date}>
                      <div className="mb-1 flex justify-between text-xs text-white/50">
                        <span>{d.date}</span>
                        <span>
                          {d.sent} accepted · {d.opened} opened ·{' '}
                          {d.clicked ?? 0} clicked · {d.failed} failed ·{' '}
                          {d.bounced ?? 0} bounced
                        </span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="bg-emerald-400/80"
                          style={{
                            width: `${Math.round((d.sent / maxDay) * 100)}%`,
                          }}
                        />
                        <div
                          className="bg-rose-400/70"
                          style={{
                            width: `${Math.round(
                              ((d.failed + (d.bounced || 0)) / maxDay) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-5">
              <h2 className="mb-4 text-sm font-semibold text-white">
                Top domains (7 days)
              </h2>
              {topDomains.length === 0 ? (
                <p className="py-10 text-center text-sm text-white/40">
                  No domain data yet
                </p>
              ) : (
                <div className="space-y-3">
                  {topDomains.map((d) => {
                    const max = topDomains[0]?.count || 1;
                    const pct = Math.round((d.count / max) * 100);
                    return (
                      <div key={d.name}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="truncate text-white/80">{d.name}</span>
                          <span className="text-fuchsia-200">{d.count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-fuchsia-500/80"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'ok' | 'bad' | 'sky' | 'violet';
}) {
  const color =
    tone === 'ok'
      ? 'text-emerald-300'
      : tone === 'bad'
        ? 'text-rose-300'
        : tone === 'sky'
          ? 'text-sky-300'
          : tone === 'violet'
            ? 'text-violet-300'
            : 'text-white';
  return (
    <div className="card p-4 text-center">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-white/45">{label}</div>
    </div>
  );
}
