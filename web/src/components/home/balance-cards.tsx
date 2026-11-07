"use client";

import {
  BankIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
} from "@phosphor-icons/react/dist/ssr";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePortfolioHoldings, usePortfolioStats } from "@/hooks/use-portfolio";
import { Skeleton } from "@/components/ui/skeleton";

export function BalanceCards() {
  const { data, isLoading } = usePortfolioHoldings();
  const { data: stats, isLoading: statsLoading } = usePortfolioStats();
  const holdingsLabel = isLoading ? "Loading…" : String(data?.balances.length ?? 0);
  const referralsLabel = statsLoading ? "Loading…" : String(stats?.referralsCount ?? 0);
  const balances = [
    { title: "Total Holdings", amount: holdingsLabel, icon: BankIcon },
    { title: "Total Referrals", amount: referralsLabel, icon: ArrowDownLeftIcon },
    { title: "Reviews", amount: statsLoading ? "Loading…" : String(stats?.reviewsCount ?? 0), icon: ArrowUpRightIcon },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {balances.map(({ title, amount, icon: Icon }) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardAction>
              <Icon size={20} aria-hidden="true" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {(isLoading && title === "Total Holdings") ||
            (statsLoading && (title === "Total Referrals" || title === "Reviews")) ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{amount}</p>
            )}
            <CardDescription>In the past 12 months</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
