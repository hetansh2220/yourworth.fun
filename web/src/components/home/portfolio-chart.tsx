"use client";

import { MetricChart } from "@/components/metric-chart";
import type { ChartConfig } from "@/components/ui/chart";
import { usePortfolioChart, usePortfolioHoldings } from "@/hooks/use-portfolio";
import { Skeleton } from "@/components/ui/skeleton";

const chartConfig = { amount: { label: "Portfolio ($)", color: "var(--primary)" } } satisfies ChartConfig;
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function toChartData(points: [number, number][] | undefined) {
  return (points ?? []).map(([timestamp, amount]) => ({
    period: new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    amount,
  }));
}

export function PortfolioChart() {
  const { data: holdings, isLoading: holdingsLoading } = usePortfolioHoldings();
  const { data: daily, isLoading: dailyLoading } = usePortfolioChart("daily");
  const { data: weekly, isLoading: weeklyLoading } = usePortfolioChart("weekly");
  const { data: monthly, isLoading: monthlyLoading } = usePortfolioChart("monthly");
  const dailyData = toChartData(daily?.points);
  const dailyPoints = daily?.points ?? [];
  const latest = dailyPoints.at(-1)?.[1] ?? 0;
  const previous = dailyPoints.at(-2)?.[1] ?? latest;
  const todayChange = latest - previous;
  const periods = [
    { value: "daily", label: "Daily", data: dailyData },
    { value: "weekly", label: "Weekly", data: toChartData(weekly?.points) },
    { value: "monthly", label: "Monthly", data: toChartData(monthly?.points) },
  ];
  const chartLoading = dailyLoading || weeklyLoading || monthlyLoading;

  return (
    <MetricChart
      title="Portfolio"
      value={holdingsLoading ? <Skeleton className="h-10 w-44" /> : currency.format(holdings?.totalUsdValue ?? 0)}
      description={<p className={`text-sm tabular-nums ${todayChange > 0 ? "text-emerald-400" : todayChange < 0 ? "text-red-400" : "text-muted-foreground"}`}>{todayChange >= 0 ? "+" : ""}{currency.format(todayChange)} Today</p>}
      config={chartConfig}
      periods={chartLoading ? periods.map((period) => ({ ...period, data: [] })) : periods}
    />
  );
}
