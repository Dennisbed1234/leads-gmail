// app/page.tsx (simplified)
'use client';

import SecScanner from '@/components/SecScanner';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-16">
            <span className="text-2xl mr-2">⚡</span>
            <h1 className="text-xl font-bold text-gray-800">LeadBot Pro</h1>
          </div>
        </div>
      </nav>
      <main>
        <SecScanner />
      </main>
    </div>
  );
}