'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { name: 'Dashboard', href: '/', icon: IconDashboard },
  { name: 'Extract Leads', href: '/extract', icon: IconSearch },
  { name: 'Email Extractor', href: '/email-extract', icon: IconExtract },
  { name: 'Enrich', href: '/enrich', icon: IconSpark },
  { name: 'Verify', href: '/verify', icon: IconCheck },
  { name: 'Leads', href: '/leads', icon: IconUsers },
  { name: 'Analytics', href: '/analytics', icon: IconChart },
  { name: 'Campaigns', href: '/campaigns', icon: IconMail },
  { name: 'Contacts', href: '/contacts', icon: IconBook },
  { name: 'Sent inbox', href: '/inbox', icon: IconInbox },
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
          open ? 'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden' : 'hidden'
        }
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={
          'fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-white/10 bg-[#12081f]/95 text-white/70 backdrop-blur-2xl transition-transform duration-200 ease-out ' +
          (open ? 'translate-x-0 ' : '-translate-x-full ') +
          'lg:translate-x-0'
        }
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-indigo-500 text-xs font-bold text-white shadow-lg shadow-fuchsia-500/30">
              CB
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white">
                CryptoByt
              </div>
              <div className="text-[11px] text-fuchsia-300/70">Lead outreach</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white lg:hidden"
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
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ' +
                  (active
                    ? 'bg-gradient-to-r from-rose-500/25 via-fuchsia-500/20 to-indigo-500/25 text-white shadow-inner'
                    : 'text-white/55 hover:bg-white/5 hover:text-white')
                }
              >
                <item.icon active={active} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 px-3 py-3">
            <div className="text-xs font-semibold text-white">CryptoByt</div>
            <div className="mt-0.5 text-[11px] text-white/45">
              Campaign monitor · Lead outreach
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function IconDashboard({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-fuchsia-300' : 'text-white/35'}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconSearch({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-fuchsia-300' : 'text-white/35'}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function IconExtract({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-fuchsia-300' : 'text-white/35'}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 15l2 2 4-4" />
    </svg>
  );
}

function IconSpark({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-fuchsia-300' : 'text-white/35'}>
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
    </svg>
  );
}

function IconCheck({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-fuchsia-300' : 'text-white/35'}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function IconUsers({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-fuchsia-300' : 'text-white/35'}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconChart({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-fuchsia-300' : 'text-white/35'}>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function IconMail({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-fuchsia-300' : 'text-white/35'}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function IconBook({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-fuchsia-300' : 'text-white/35'}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconInbox({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-fuchsia-300' : 'text-white/35'}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconSettings({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? 'text-fuchsia-300' : 'text-white/35'}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  );
}
