import { ServiceCard } from "@/components/market/service-card";

export function MarketSettings() {
  return (
    <main className="w-full p-4 pt-8 sm:p-6 sm:pt-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-[32px] font-medium tracking-tight">Market</h1>
          <p className="text-sm text-muted-foreground">Edit your services and manage their availability.</p>
        </header>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <ServiceCard type="dms" />
          <ServiceCard type="group" />
        </div>
      </div>
    </main>
  );
}
