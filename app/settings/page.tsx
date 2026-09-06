'use client';

import { Database, Shield, Mail, Info } from 'lucide-react';

const vars = [
  {
    key: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL connection string from Neon, Supabase, or Railway.',
    icon: Database,
  },
  {
    key: 'SEC_USER_AGENT',
    required: true,
    description:
      'Descriptive User-Agent for SEC EDGAR, e.g. "LeadBot Pro (you@domain.com)".',
    icon: Shield,
  },
  {
    key: 'SMTP_HOST / SMTP_USER / SMTP_PASS',
    required: false,
    description: 'Required only if you want to send real email campaigns.',
    icon: Mail,
  },
];

export default function SettingsPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          Environment configuration for production
        </p>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3 text-sm text-primary-900">
        <Info size={18} className="mt-0.5 shrink-0 text-primary-600" />
        <p>
          Set these in <strong>Vercel → Project → Settings → Environment
          Variables</strong>, then redeploy. Never commit secrets to the repo.
        </p>
      </div>

      <div className="space-y-4">
        {vars.map((v) => (
          <div key={v.key} className="card p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-slate-100 p-2.5 text-slate-600">
                <v.icon size={18} />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-800">
                    {v.key}
                  </code>
                  {v.required ? (
                    <span className="badge bg-red-50 text-red-700">Required</span>
                  ) : (
                    <span className="badge bg-slate-100 text-slate-600">Optional</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-slate-600">{v.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 card p-6">
        <h2 className="text-sm font-semibold text-slate-900">About verification</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Google does not expose a public API to confirm Gmail account existence.
          LeadBot validates format + MX records and scores pattern quality.
          For higher accuracy later, integrate a paid email verification provider
          (Hunter, ZeroBounce, etc.).
        </p>
      </div>
    </div>
  );
}
