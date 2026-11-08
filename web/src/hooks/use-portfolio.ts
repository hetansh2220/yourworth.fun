"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { getPortfolioBalance, getPortfolioChart, getPortfolioHoldings, getPortfolioStats, type PortfolioChartPeriod, type PortfolioHoldingsResponse } from "@/utils/api/portfolio";

export const portfolioBalanceQueryKey = ["portfolio", "balance"] as const;
export const portfolioHoldingsQueryKey = ["portfolio", "holdings"] as const;
export const portfolioStatsQueryKey = ["portfolio", "stats"] as const;
export const portfolioChartQueryKey = ["portfolio", "chart"] as const;

function usePortfolioAuth() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  return { ready, authenticated, getAccessToken };
}

function missingTokenError() { return new Error("Your session is unavailable. Please try again."); }

export function usePortfolioBalance() {
  const { ready, authenticated, getAccessToken } = usePortfolioAuth();
  return useQuery({ queryKey: portfolioBalanceQueryKey, enabled: ready && authenticated, queryFn: async () => { const token = await getAccessToken(); if (!token) throw missingTokenError(); return getPortfolioBalance(token); } });
}

export function usePortfolioHoldings(options: { page?: number; limit?: number; queryOptions?: Omit<UseQueryOptions<PortfolioHoldingsResponse, Error>, "queryKey" | "queryFn"> } = {}) {
  const { ready, authenticated, getAccessToken } = usePortfolioAuth();
  const page = options.page ?? 1;
  const limit = options.limit ?? 100;
  return useQuery({ ...options.queryOptions, queryKey: [...portfolioHoldingsQueryKey, page, limit], enabled: ready && authenticated && (options.queryOptions?.enabled ?? true), queryFn: async () => { const token = await getAccessToken(); if (!token) throw missingTokenError(); return getPortfolioHoldings(token, { page, limit }); } });
}

export function usePortfolioStats() {
  const { ready, authenticated, getAccessToken } = usePortfolioAuth();
  const query = useQuery({ queryKey: portfolioStatsQueryKey, enabled: ready && authenticated, queryFn: async () => { const token = await getAccessToken(); if (!token) throw missingTokenError(); return getPortfolioStats(token); } });

  useEffect(() => {
    if (query.data) {
      console.log("[portfolio] stats data", query.data);
    }
  }, [query.data]);

  return query;
}

export function usePortfolioChart(period: PortfolioChartPeriod = "daily") {
  const { ready, authenticated, getAccessToken } = usePortfolioAuth();
  return useQuery({ queryKey: [...portfolioChartQueryKey, period], enabled: ready && authenticated, queryFn: async () => { const token = await getAccessToken(); if (!token) throw missingTokenError(); return getPortfolioChart(token, period); } });
}
