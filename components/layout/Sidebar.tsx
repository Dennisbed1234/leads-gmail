'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { name: 'Dashboard', href: '/', icon: IconDashboard },
  { name: 'Extract Leads', href: '/extract', icon: IconSearch },
  { name: 'Enrich', href: '/enrich', icon: IconSpark },
  { name: 'Leads', href: '/leads', icon: IconUsers },
  { name: 'Analytics', href: '/analytics', icon: IconChart },
  { name: 'Campaigns', href: '/campaigns', icon: IconMail },
  { name: 'Settings', href: '/settings', icon: IconSettings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={
          open
            ? 'fixed inset-0 z-40 bg-slate-900/50 lg:hidden'
            : 'hidden'
        }
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={
          'fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col bg-slate-900 text-slate-300 transition-transform duration-200 ease-out ' +
          (open ? 'translate-x-0 ' : '-translate-x-full ') +
          'lg:translate-x-0'
        }
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              LB
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-white">
                LeadBot Pro
              </div>
              <div className="text-[11px] text-slate-500">SEC + Enrichment</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {nav.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ' +
                  (active
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200')
                }
              >
                <item.icon active={active} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-lg bg-white/5 px-3 py-3">
            <div className="text-xs font-medium text-slate-300">Public sources</div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              SEC · GitHub · Contact pages
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function IconDashboard({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-indigo-400' : 'text-slate-500'}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconSearch({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-indigo-400' : 'text-slate-500'}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function IconSpark({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-indigo-400' : 'text-slate-500'}>
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
    </svg>
  );
}

function IconUsers({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-indigo-400' : 'text-slate-500'}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconChart({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-indigo-400' : 'text-slate-500'}>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function IconMail({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-indigo-400' : 'text-slate-500'}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function IconSettings({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-indigo-400' : 'text-slate-500'}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  );
}
