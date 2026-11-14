import { EarningsChart } from "@/components/earnings/earnings-chart";
import { EarningsAnalytics } from "@/components/earnings/earnings-analytics";
import { TopSpenders } from "@/components/earnings/top-spenders";

export default function EarningsPage() {
  return (
    <main className="grid items-start gap-4 p-4 lg:grid-cols-3">
      <h1 className="sr-only">Earnings</h1>
      <div className="min-w-0 space-y-8 lg:col-span-2">
        <EarningsChart />
        <EarningsAnalytics />
      </div>
      <div className="min-w-0 space-y-4">
        {/* Top holders will be enabled when the backend provides holder data. */}
        <TopSpenders />
      </div>
    </main>
  );
}
