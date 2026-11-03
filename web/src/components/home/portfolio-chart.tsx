"use client";

import { MetricChart } from "@/components/metric-chart";
import type { ChartConfig } from "@/components/ui/chart";
import { useBalances } from "@/hooks/use-balance";
import { Skeleton } from "@/components/ui/skeleton";

const monthlyData = [
  { period: "Jan", amount: 18000 }, { period: "Feb", amount: 28000 },
  { period: "Mar", amount: 46000 }, { period: "Apr", amount: 74000 },
  { period: "May", amount: 52000 }, { period: "Jun", amount: 88000 },
  { period: "Jul", amount: 64000 }, { period: "Aug", amount: 78000 },
  { period: "Sep", amount: 66000 }, { period: "Oct", amount: 55000 },
  { period: "Nov", amount: 61000 }, { period: "Dec", amount: 55000 },
];
const dailyData = [
  { period: "Mon", amount: 51800 }, { period: "Tue", amount: 52450 },
  { period: "Wed", amount: 52000 }, { period: "Thu", amount: 53800 },
  { period: "Fri", amount: 53250 }, { period: "Sat", amount: 54100 },
  { period: "Sun", amount: 55000 },
];
const weeklyData = [
  { period: "Week 1", amount: 51000 },
  { period: "Week 2", amount: 53500 },
  { period: "Week 3", amount: 52800 },
  { period: "Week 4", amount: 55000 },
];
const periods = [
  { value: "daily", label: "Daily", data: dailyData },
  { value: "weekly", label: "Weekly", data: weeklyData },
  { value: "monthly", label: "Monthly", data: monthlyData },
];
const chartConfig = { amount: { label: "Portfolio ($)", color: "var(--primary)" } } satisfies ChartConfig;
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const portfolioValue = dailyData[dailyData.length - 1].amount;
const todayChange = portfolioValue - dailyData[dailyData.length - 2].amount;

export function PortfolioChart() {
  const { data, isLoading } = useBalances();

  return (
    <MetricChart
      title="Portfolio"
      value={isLoading ? <Skeleton className="h-10 w-44" /> : currency.format(data?.totalUsdValue ?? 0)}
      description={<p className={`text-sm tabular-nums ${todayChange > 0 ? "text-emerald-400" : todayChange < 0 ? "text-red-400" : "text-muted-foreground"}`}>{todayChange >= 0 ? "+" : ""}{currency.format(todayChange)} Today</p>}
      config={chartConfig}
      periods={periods}
    />
  );
}
