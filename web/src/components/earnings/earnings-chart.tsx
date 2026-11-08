"use client";

import { useState } from "react";
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

function formatChartPoints(
  points: { period: string; amount: number }[],
  period: "daily" | "weekly" | "monthly",
) {
  const today = new Date();
  const lastIndex = points.length - 1;

  return points.map((point, index) => {
    const date = new Date(today);
    const distance = lastIndex - index;

    if (period === "daily") date.setDate(date.getDate() - distance);
    if (period === "weekly") date.setDate(date.getDate() - distance * 7);
    if (period === "monthly") date.setMonth(date.getMonth() - distance);

    return {
      period:
        period === "monthly"
          ? date.toLocaleDateString("en-US", { month: "short" })
          : date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
      amount: point.amount,
    };
  });
}

export function EarningsChart() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const earnings = useEarnings();
  const chart = useEarningsChart(period);
  const chartData = formatChartPoints(chart.data?.points ?? [], period);
  const todayEarnings = period === "daily" ? chartData.at(-1)?.amount ?? 0 : 0;
  const loading = chart.isLoading;
  const periods = [
    { value: "daily", label: "Daily", data: period === "daily" ? chartData : [] },
    { value: "weekly", label: "Weekly", data: period === "weekly" ? chartData : [] },
    { value: "monthly", label: "Monthly", data: period === "monthly" ? chartData : [] },
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
      selectedPeriod={period}
      onValueChange={(value) => setPeriod(value as typeof period)}
    />
  );
}
