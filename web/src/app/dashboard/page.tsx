import { BalanceCards } from "@/components/home/balance-cards";
import { PortfolioChart } from "@/components/home/portfolio-chart";
import { CryptoWatchlist } from "@/components/home/crypto-watchlist";
import { TotalBalance } from "@/components/home/total-balance";
import { TransactionHistory } from "@/components/home/transaction-history";

export default function Home() {
  return (
    <main className="grid gap-4 p-4 lg:grid-cols-3">
      <h1 className="sr-only">Home dashboard</h1>
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <PortfolioChart />
        <div className="pt-4">
          <BalanceCards />
        </div>
        <TransactionHistory />
      </div>
      <div className="min-w-0 space-y-4">
        <TotalBalance depositAddress="7sQArAHvjCjVNJ97VoBZREY1pE2VvWJ1CsGiKsBSQHTh" />
        <CryptoWatchlist />
      </div>
    </main>
  );
}
