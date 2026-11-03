"use client";

import type { ReactNode } from "react";
import { Area, AreaChart, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MetricChartProps = {
  title: string;
  value: ReactNode;
  description: ReactNode;
  config: ChartConfig;
  periods: {
    value: string;
    label: string;
    data: { period: string; amount: number }[];
  }[];
};

export function MetricChart({
  title,
  value,
  description,
  config: chartConfig,
  periods,
}: MetricChartProps) {
  return (
    <Tabs defaultValue="daily" className="gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="font-heading text-[32px] font-medium leading-[1.13] tracking-[-1px]">
            {title}
          </h2>
          <div className="flex flex-wrap items-baseline gap-3">
            <p className="font-heading text-[32px] font-medium leading-[1.13] tracking-[-1px] tabular-nums">
              {value}
            </p>
            {description}
          </div>
        </div>
        <TabsList aria-label={`${title} period`}>
          {periods.map((period) => (
            <TabsTrigger key={period.value} value={period.value}>
              {period.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </header>
      {periods.map((period) => (
        <TabsContent key={period.value} value={period.value}>
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <AreaChart
              accessibilityLayer
              data={period.data}
              margin={{ left: 0, right: 12, top: 12 }}
            >
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tickMargin={10}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="amount"
                type="monotone"
                fill="none"
                stroke="var(--color-amount)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </TabsContent>
      ))}
    </Tabs>
  );
}
