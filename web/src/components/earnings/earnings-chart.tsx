"use client";

import { MetricChart } from "@/components/metric-chart";
import type { ChartConfig } from "@/components/ui/chart";
import { useEarningsChart, useEarnings } from "@/hooks/use-earnings";
const chartConfig = {
  amount: { label: "Earnings ($)", color: "var(--primary)" },
} satisfies ChartConfig;
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function EarningsChart() {
  const earnings = useEarnings();
  const daily = useEarningsChart("daily");
  const weekly = useEarningsChart("weekly");
  const monthly = useEarningsChart("monthly");
  const dailyData = daily.data?.points ?? [];
  const weeklyData = weekly.data?.points ?? [];
  const monthlyData = monthly.data?.points ?? [];
  const todayEarnings = dailyData.at(-1)?.amount ?? 0;
  const loading =
    earnings.isLoading ||
    daily.isLoading ||
    weekly.isLoading ||
    monthly.isLoading;
  const periods = [
    { value: "daily", label: "Daily", data: dailyData },
    { value: "weekly", label: "Weekly", data: weeklyData },
    { value: "monthly", label: "Monthly", data: monthlyData },
  ];

  return (
    <MetricChart
      title="Total earnings"
      value={earnings.data?.earnings ?? 0.0}
      description={
        <p
          className={`text-sm tabular-nums ${todayEarnings > 0.0 ? "text-emerald-400" : todayEarnings < 0.0 ? "text-red-400" : "text-muted-foreground"}`}
        >
          {currency.format(todayEarnings)} Today
        </p>
      }
      config={chartConfig}
      periods={periods}
      loading={loading}
    />
  );
}
