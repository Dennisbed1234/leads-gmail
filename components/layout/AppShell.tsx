'use client';

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const els = () => Array.from(document.querySelectorAll('.reveal'));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    const observeAll = () => {
      els().forEach((el) => io.observe(el));
    };

    observeAll();

    const mo = new MutationObserver(() => observeAll());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <div className="relative min-h-screen">
      <div
        className="glow-orb"
        style={{
          top: '10%',
          left: '-8%',
          background: 'radial-gradient(circle, #f43f5e 0%, transparent 70%)',
        }}
      />
      <div
        className="glow-orb"
        style={{
          top: '40%',
          right: '-10%',
          background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)',
        }}
      />

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-black/30 px-4 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white hover:bg-white/10"
          aria-label="Open navigation menu"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <span className="bg-gradient-to-r from-rose-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-sm font-bold text-transparent">
          CryptoByt
        </span>
      </header>

      <div className="relative z-10 lg:pl-64">
        <main className="min-h-[calc(100vh-3.5rem)] lg:min-h-screen">
          <div className="reveal mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
