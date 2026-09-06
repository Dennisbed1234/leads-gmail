import SecScanner from "@/components/SecScanner";
import LeadTable from "@/components/LeadTable";
import Dashboard from "@/components/Dashboard";
import Analytics from "@/components/Analytics";
import CampaignManager from "@/components/CampaignManager";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Dashboard />
      <SecScanner />
      <LeadTable />
      <Analytics />
      <CampaignManager />
    </main>
  );
}
