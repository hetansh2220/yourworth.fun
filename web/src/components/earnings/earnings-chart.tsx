"use client";

import { MetricChart } from "@/components/metric-chart";
import type { ChartConfig } from "@/components/ui/chart";

const monthlyData = [
  { period: "Jan", amount: 18000 }, { period: "Feb", amount: 28000 },
  { period: "Mar", amount: 46000 }, { period: "Apr", amount: 74000 },
  { period: "May", amount: 52000 }, { period: "Jun", amount: 88000 },
  { period: "Jul", amount: 64000 }, { period: "Aug", amount: 78000 },
  { period: "Sep", amount: 66000 }, { period: "Oct", amount: 55000 },
  { period: "Nov", amount: 61000 }, { period: "Dec", amount: 55000 },
];
const dailyData = [
  { period: "Mon", amount: 1200 }, { period: "Tue", amount: 1850 },
  { period: "Wed", amount: 1400 }, { period: "Thu", amount: 2300 },
  { period: "Fri", amount: 1750 }, { period: "Sat", amount: 2100 },
  { period: "Sun", amount: 1900 },
];
const weeklyData = [
  { period: "Week 1", amount: 13500 },
  { period: "Week 2", amount: 14200 },
  { period: "Week 3", amount: 14800 },
  { period: "Week 4", amount: dailyData.reduce((sum, day) => sum + day.amount, 0) },
];
const periods = [
  { value: "daily", label: "Daily", data: dailyData },
  { value: "weekly", label: "Weekly", data: weeklyData },
  { value: "monthly", label: "Monthly", data: monthlyData },
];
const chartConfig = { amount: { label: "Earnings ($)", color: "var(--primary)" } } satisfies ChartConfig;
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const totalEarnings = monthlyData.reduce((sum, month) => sum + month.amount, 0);
const todayEarnings = dailyData[dailyData.length - 1].amount;

export function EarningsChart() {
  return (
    <MetricChart
      title="Total earnings"
      value={currency.format(totalEarnings)}
      description={<p className={`text-sm tabular-nums ${todayEarnings > 0 ? "text-emerald-400" : todayEarnings < 0 ? "text-red-400" : "text-muted-foreground"}`}>{currency.format(todayEarnings)} Today</p>}
      config={chartConfig}
      periods={periods}
    />
  );
}
