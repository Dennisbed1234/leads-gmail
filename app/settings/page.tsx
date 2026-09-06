'use client';

export default function SettingsPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          How to configure the app on Vercel (no secrets are stored or shown here)
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
        Add these in <strong>Vercel → Project → Settings → Environment
        Variables</strong>, then redeploy. This page only lists variable{' '}
        <em>names</em> — it never displays your real passwords or connection strings.
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-800">
              DATABASE_URL
            </code>
            <span className="badge bg-red-50 text-red-700">Required</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            PostgreSQL connection string from Neon, Supabase, or Railway.
          </p>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-800">
              SEC_USER_AGENT
            </code>
            <span className="badge bg-red-50 text-red-700">Required</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Example:{' '}
            <span className="font-mono text-xs">LeadBot Pro (you@domain.com)</span>
          </p>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-800">
              ZEROBOUNCE_API_KEY
            </code>
            <span className="badge bg-slate-100 text-slate-600">For real inbox verify</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Optional. Free mode only checks syntax + MX. Add a ZeroBounce API key to
            confirm whether a mailbox exists. Get a key at zerobounce.net.
          </p>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-800">
              GITHUB_TOKEN
            </code>
            <span className="badge bg-slate-100 text-slate-600">Recommended</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Personal access token for GitHub Enrich (higher API rate limits).
          </p>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-800">
              SMTP_HOST / SMTP_USER / SMTP_PASS
            </code>
            <span className="badge bg-slate-100 text-slate-600">Optional</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Needed to send campaigns. Use a Gmail App Password for SMTP_PASS.
          </p>
        </div>
      </div>
    </div>
  );
}
