'use client';

import { useState, useEffect } from 'react';
import SecScanner from '@/components/SecScanner';
import LeadTable from '@/components/LeadTable';
import Dashboard from '@/components/Dashboard';
import Analytics from '@/components/Analytics';
import CampaignManager from '@/components/CampaignManager';

export default function Home() {
  const [activeTab, setActiveTab] = useState('scan');
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    fetch('/api/leads')
      .then(res => res.json())
      .then(data => setLeads(data.leads || []))
      .catch(console.error);
  }, []);

  const tabs = [
    { id: 'scan', label: '🔍 Scan', component: SecScanner },
    { id: 'leads', label: '📋 Leads', component: LeadTable },
    { id: 'dashboard', label: '📊 Dashboard', component: Dashboard },
    { id: 'analytics', label: '📈 Analytics', component: Analytics },
    { id: 'campaign', label: '✉️ Campaign', component: CampaignManager },
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || SecScanner;

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <h1 className="text-xl font-bold text-gray-800">LeadBot Pro</h1>
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                SEC EDGAR
              </span>
            </div>
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-6">
        {activeTab === 'leads' ? (
          <LeadTable leads={leads} />
        ) : activeTab === 'dashboard' ? (
          <Dashboard />
        ) : activeTab === 'analytics' ? (
          <Analytics />
        ) : activeTab === 'campaign' ? (
          <CampaignManager />
        ) : (
          <SecScanner />
        )}
      </main>
    </div>
  );
}