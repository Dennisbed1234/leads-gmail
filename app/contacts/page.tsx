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

type BatchMode = 'next' | 'least' | 'oldest' | 'random';

const DAILY_LIMIT_KEY = 'lb_daily_limit';
const DAILY_SENT_KEY = 'lb_daily_sent';
const CURSOR_KEY = 'lb_batch_cursor';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadDailySent(): number {
  try {
    const raw = localStorage.getItem(DAILY_SENT_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { day: string; count: number };
    if (parsed.day !== todayKey()) return 0;
    return Number(parsed.count) || 0;
  } catch {
    return 0;
  }
}

function saveDailySent(count: number) {
  try {
    localStorage.setItem(
      DAILY_SENT_KEY,
      JSON.stringify({ day: todayKey(), count })
    );
  } catch {
    // ignore
  }
}

function previewTokens(template: string) {
  return template
    .split('{{name}}').join('Recipient')
    .split('{{company}}').join('Company')
    .split('{{email}}').join('name@example.com')
    .split('{{title}}').join('Title');
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickN, setPickN] = useState(50);
  const [batchMode, setBatchMode] = useState<BatchMode>('next');
  const [cursor, setCursor] = useState(0);
  /** Emails already used in a successful send this browser session */
  const [sessionSent, setSessionSent] = useState<Set<string>>(new Set());
  const [skipSessionSent, setSkipSessionSent] = useState(true);
  const [skipRecentDays, setSkipRecentDays] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(100);
  const [dailySent, setDailySent] = useState(0);

  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [textBody, setTextBody] = useState('');
  const [sendAsHtml, setSendAsHtml] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Restore prefs
  useEffect(() => {
    try {
      const lim = Number(localStorage.getItem(DAILY_LIMIT_KEY));
      if (lim > 0) setDailyLimit(lim);
      setDailySent(loadDailySent());
      const cur = Number(localStorage.getItem(CURSOR_KEY));
      if (cur >= 0) setCursor(cur);
    } catch {
      // ignore
    }
  }, []);

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

  /** Pool eligible for batch pick (respects skip filters) */
  const eligible = useMemo(() => {
    const now = Date.now();
    const recentMs = skipRecentDays > 0 ? skipRecentDays * 86400000 : 0;
    return contacts.filter((c) => {
      if (skipSessionSent && sessionSent.has(c.email)) return false;
      if (recentMs > 0) {
        const last = new Date(c.lastSentAt).getTime();
        if (now - last < recentMs) return false;
      }
      return true;
    });
  }, [contacts, sessionSent, skipSessionSent, skipRecentDays]);

  const remainingToday = Math.max(0, dailyLimit - dailySent);

  const orderedForMode = useMemo(() => {
    if (batchMode === 'least') {
      return [...eligible].sort(
        (a, b) => a.sendCount - b.sendCount || a.email.localeCompare(b.email)
      );
    }
    if (batchMode === 'oldest') {
      return [...eligible].sort(
        (a, b) =>
          new Date(a.lastSentAt).getTime() - new Date(b.lastSentAt).getTime()
      );
    }
    if (batchMode === 'random') {
      return shuffle(eligible);
    }
    // next = stable list order (lastSent desc from API)
    return eligible;
  }, [eligible, batchMode]);

  const safeCursor = Math.min(cursor, Math.max(0, orderedForMode.length));

  const toggle = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  /** Select next batch of N from cursor, advance cursor, respect daily remaining */
  const selectNextBatch = (n?: number) => {
    const want = Math.max(1, Math.min(n ?? pickN, 500));
    const capped = Math.min(want, remainingToday > 0 ? remainingToday : want);
    if (remainingToday <= 0 && dailyLimit > 0) {
      setError(
        `Daily limit reached (${dailySent}/${dailyLimit}). Raise the limit or wait until tomorrow.`
      );
      return;
    }
    const pool = orderedForMode;
    if (pool.length === 0) {
      setError('No eligible contacts left (filters may be hiding everyone).');
      return;
    }
    let start = batchMode === 'random' ? 0 : safeCursor;
    if (start >= pool.length) start = 0; // wrap
    const slice = pool.slice(start, start + capped);
    // If near end, wrap leftover
    if (slice.length < capped && batchMode !== 'random') {
      const need = capped - slice.length;
      slice.push(...pool.slice(0, need));
    }
    const emails = slice.map((c) => c.email);
    setSelected(new Set(emails));
    if (batchMode === 'next' || batchMode === 'least' || batchMode === 'oldest') {
      const nextCur = (start + emails.length) % Math.max(pool.length, 1);
      setCursor(nextCur);
      try {
        localStorage.setItem(CURSOR_KEY, String(nextCur));
      } catch {
        // ignore
      }
    }
    setError('');
  };

  /** Select first N eligible only (does not advance cursor) */
  const selectFirstN = (n: number) => {
    const take = Math.max(1, Math.min(n, orderedForMode.length, remainingToday || n));
    setSelected(new Set(orderedForMode.slice(0, take).map((c) => c.email)));
  };

  const selectAllEligible = () => {
    if (orderedForMode.length > remainingToday && dailyLimit > 0) {
      setError(
        `Not selecting all ${orderedForMode.length} — would exceed daily limit (${remainingToday} left). Use “Next batch” instead.`
      );
      // Soft select only remaining quota
      setSelected(
        new Set(orderedForMode.slice(0, remainingToday).map((c) => c.email))
      );
      return;
    }
    setSelected(new Set(orderedForMode.map((c) => c.email)));
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
      if (!dryRun && selected.size > remainingToday && dailyLimit > 0) {
        throw new Error(
          `Selection (${selected.size}) exceeds remaining daily quota (${remainingToday}). Reduce selection or raise daily limit.`
        );
      }
      if (!subject.trim()) throw new Error('Subject is required');

      if (sendAsHtml && !htmlBody.trim()) {
        throw new Error('HTML body is required');
      }
      if (!sendAsHtml && !textBody.trim() && !htmlBody.trim()) {
        throw new Error('Email body is required');
      }

      const to = selectedList
        .map((c) => (c.name ? `${c.name} <${c.email}>` : c.email))
        .join('\n');

      const res = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'manual',
          to,
          subject,
          html: sendAsHtml,
          htmlBody: htmlBody.trim() || undefined,
          textBody: textBody.trim() || undefined,
          body: sendAsHtml ? htmlBody : textBody || htmlBody,
          limit: Math.min(selected.size, 500),
          dryRun,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setResult(data);

      if (!dryRun && data.sent > 0) {
        const sentEmails: string[] = Array.isArray(data.sentTo)
          ? data.sentTo.map((e: string) => e.toLowerCase())
          : selectedList.map((c) => c.email);

        setSessionSent((prev) => {
          const next = new Set(prev);
          sentEmails.forEach((e) => next.add(e));
          return next;
        });

        const newDaily = dailySent + Number(data.sent || 0);
        setDailySent(newDaily);
        saveDailySent(newDaily);

        // Drop successfully sent from selection so next batch is clean
        setSelected((prev) => {
          const next = new Set(prev);
          sentEmails.forEach((e) => next.delete(e));
          return next;
        });

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

  const resetCursor = () => {
    setCursor(0);
    try {
      localStorage.setItem(CURSOR_KEY, '0');
    } catch {
      // ignore
    }
  };

  const resetDaily = () => {
    setDailySent(0);
    saveDailySent(0);
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">
            Successful recipients — batch-safe selection for daily limits
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-white">{contacts.length}</div>
          <div className="text-xs text-white/45">Unique contacts</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-cyan-300">{eligible.length}</div>
          <div className="text-xs text-white/45">Eligible now</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-fuchsia-300">{selected.size}</div>
          <div className="text-xs text-white/45">Selected</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-amber-300">
            {remainingToday}
          </div>
          <div className="text-xs text-white/45">
            Left today ({dailySent}/{dailyLimit})
          </div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-emerald-300">
            {sessionSent.size}
          </div>
          <div className="text-xs text-white/45">Sent this session</div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {/* Smart batch toolbar */}
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label text-xs">Batch size</label>
            <input
              type="number"
              min={1}
              max={500}
              className="input w-24"
              value={pickN}
              onChange={(e) => setPickN(Number(e.target.value) || 50)}
            />
          </div>
          <div>
            <label className="label text-xs">Pick mode</label>
            <select
              className="input"
              value={batchMode}
              onChange={(e) => setBatchMode(e.target.value as BatchMode)}
            >
              <option value="next">Next batch (cursor)</option>
              <option value="least">Least emailed</option>
              <option value="oldest">Oldest last-sent</option>
              <option value="random">Random</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Daily limit</label>
            <input
              type="number"
              min={1}
              max={5000}
              className="input w-24"
              value={dailyLimit}
              onChange={(e) => {
                const v = Number(e.target.value) || 100;
                setDailyLimit(v);
                try {
                  localStorage.setItem(DAILY_LIMIT_KEY, String(v));
                } catch {
                  // ignore
                }
              }}
            />
          </div>
          <div>
            <label className="label text-xs">Skip if sent in last (days)</label>
            <input
              type="number"
              min={0}
              max={365}
              className="input w-24"
              value={skipRecentDays}
              onChange={(e) => setSkipRecentDays(Number(e.target.value) || 0)}
              title="0 = off"
            />
          </div>
          <label className="inline-flex items-center gap-2 pb-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={skipSessionSent}
              onChange={(e) => setSkipSessionSent(e.target.checked)}
            />
            Skip already sent this session
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => selectNextBatch()}
            disabled={loading || eligible.length === 0}
          >
            Select next {pickN}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => selectFirstN(pickN)}
          >
            Select first {pickN} eligible
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={selectAllEligible}
            title="Capped by daily remaining quota"
          >
            Select all eligible (safe)
          </button>
          <button type="button" className="btn-secondary" onClick={clearSelection}>
            Clear selection
          </button>
          <button type="button" className="btn-ghost text-xs" onClick={resetCursor}>
            Reset batch cursor ({safeCursor})
          </button>
          <button type="button" className="btn-ghost text-xs" onClick={resetDaily}>
            Reset daily counter
          </button>
          <button
            type="button"
            className="btn-ghost text-xs"
            disabled={selected.size === 0}
            onClick={exportSelected}
          >
            Export selected .txt
          </button>
        </div>

        <p className="text-xs text-white/40">
          <strong className="text-white/60">How to use:</strong> set batch size
          (e.g. 50) → click <em>Select next 50</em> → send → click{' '}
          <em>Select next 50</em> again for the following batch. Cursor remembers
          position. Session-sent contacts are skipped so you never re-hit the same
          people until you refresh the page or turn the skip off.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search email or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <button type="button" className="btn-secondary" onClick={() => load()}>
          Search
        </button>
      </div>

      {/* Contact list */}
      <div className="card overflow-hidden">
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
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[#1a0f2e] text-xs uppercase text-white/45">
                <tr>
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={
                        orderedForMode.length > 0 &&
                        selected.size >= orderedForMode.length
                      }
                      onChange={(e) =>
                        e.target.checked ? selectAllEligible() : clearSelection()
                      }
                      aria-label="Select all eligible"
                    />
                  </th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Sends</th>
                  <th className="px-3 py-2">Last sent</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {contacts.map((c) => {
                  const isSession = sessionSent.has(c.email);
                  const isEligible = eligible.some((e) => e.email === c.email);
                  return (
                    <tr
                      key={c.email}
                      className={
                        'cursor-pointer hover:bg-white/5 ' +
                        (selected.has(c.email) ? 'bg-fuchsia-500/10 ' : '') +
                        (isSession ? 'opacity-50 ' : '')
                      }
                      onClick={() => toggle(c.email)}
                    >
                      <td
                        className="px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                      <td className="px-3 py-2 text-xs text-white/60">
                        {c.sendCount}
                      </td>
                      <td className="px-3 py-2 text-xs text-white/45 whitespace-nowrap">
                        {new Date(c.lastSentAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-[10px] uppercase tracking-wide">
                        {isSession ? (
                          <span className="text-amber-300/90">session</span>
                        ) : !isEligible ? (
                          <span className="text-white/30">filtered</span>
                        ) : (
                          <span className="text-emerald-400/80">ready</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HTML email composer */}
      <div className="card space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">
            HTML email · {selected.size} selected
            {remainingToday < selected.size && dailyLimit > 0 ? (
              <span className="ml-2 text-sm font-normal text-rose-300">
                (over daily remaining {remainingToday})
              </span>
            ) : null}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={sendAsHtml}
                onChange={(e) => setSendAsHtml(e.target.checked)}
              />
              Send as HTML
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={showPreview}
                onChange={(e) => setShowPreview(e.target.checked)}
              />
              Live preview
            </label>
          </div>
        </div>

        <div>
          <label className="label">Subject</label>
          <input
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder=""
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-white/35">
            Optional tokens: {'{{name}}'} {'{{company}}'} {'{{email}}'}{' '}
            {'{{title}}'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="label">HTML body</label>
            <textarea
              className="input min-h-[280px] resize-y font-mono text-xs"
              rows={16}
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              placeholder=""
              spellCheck={false}
            />
            <p className="mt-1.5 text-xs text-white/35">
              Paste your full HTML email here. Inline CSS works best in Gmail.
            </p>
          </div>

          <div>
            <label className="label">Plain text (optional fallback)</label>
            <textarea
              className="input min-h-[280px] resize-y font-mono text-xs"
              rows={16}
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              placeholder=""
              spellCheck={false}
            />
            <p className="mt-1.5 text-xs text-white/35">
              Optional. Used when the client cannot show HTML.
            </p>
          </div>
        </div>

        {showPreview ? (
          <div>
            <label className="label">HTML preview</label>
            <div
              className="overflow-auto rounded-xl border border-white/10 bg-black/40 p-4"
              style={{ minHeight: 160, maxHeight: 480 }}
              dangerouslySetInnerHTML={{
                __html: htmlBody.trim()
                  ? previewTokens(htmlBody)
                  : '<p style="color:#64748b;font-family:sans-serif;font-size:13px;margin:0">HTML preview appears here when you paste markup above.</p>',
              }}
            />
          </div>
        ) : null}

        {selected.size > 0 ? (
          <div className="max-h-24 overflow-auto rounded-lg bg-black/30 p-2 font-mono text-[11px] text-white/50">
            {selectedList
              .slice(0, 40)
              .map((c) => c.email)
              .join(', ')}
            {selectedList.length > 40
              ? ` … +${selectedList.length - 40} more`
              : ''}
          </div>
        ) : (
          <p className="text-sm text-white/40">
            Use <strong>Select next {pickN}</strong> above, then paste HTML and
            send.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={sending || selected.size === 0}
            onClick={() => sendToSelected(true)}
          >
            Preview send
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={
              sending ||
              selected.size === 0 ||
              (dailyLimit > 0 && selected.size > remainingToday)
            }
            onClick={() => sendToSelected(false)}
          >
            {sending
              ? 'Sending…'
              : `Send HTML to ${selected.size || 0} contact${selected.size === 1 ? '' : 's'}`}
          </button>
          {!sending && selected.size > 0 && remainingToday >= selected.size ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                await sendToSelected(false);
                // After send, auto-prep next batch if send succeeded
                // (selection cleared inside send; pick next)
                setTimeout(() => selectNextBatch(pickN), 1000);
              }}
              title="Send current batch, then auto-select the next batch"
            >
              Send & load next {pickN}
            </button>
          ) : null}
        </div>

        {result ? (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
