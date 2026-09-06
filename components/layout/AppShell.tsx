'use client';

import Sidebar from './Sidebar';

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <Sidebar />
      <div className="pl-64">
        <main className="min-h-screen">
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
