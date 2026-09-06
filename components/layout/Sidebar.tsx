'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  Users,
  BarChart3,
  Mail,
  Settings,
  Zap,
} from 'lucide-react';
import { clsx } from 'clsx';

const nav = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Extract Leads', href: '/extract', icon: Search },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Campaigns', href: '/campaigns', icon: Mail },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-surface-900 text-slate-300">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-white/5 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
          <Zap className="h-4.5 w-4.5 text-white" size={18} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white tracking-tight">
            LeadBot Pro
          </div>
          <div className="text-[11px] text-slate-500">SEC + Gmail Engine</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {nav.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              )}
            >
              <item.icon
                size={18}
                className={clsx(
                  active ? 'text-primary-400' : 'text-slate-500 group-hover:text-slate-300'
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 p-4">
        <div className="rounded-lg bg-white/5 px-3 py-3">
          <div className="text-xs font-medium text-slate-300">SEC EDGAR</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            Live public filings data
          </div>
        </div>
      </div>
    </aside>
  );
}
