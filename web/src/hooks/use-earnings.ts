"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import {
  getEarningsChart,
  getEarnings,
  getEarningsSpenders,
  type EarningsPeriod,
} from "@/utils/api/earnings";

export const earningsChartQueryKey = ["earnings", "chart"] as const;
export const earningsQueryKey = ["earnings"] as const;
export const earningsSpendersQueryKey = ["earnings", "spenders"] as const;

function missingTokenError() {
  return new Error("Your session is unavailable. Please try again.");
}

export function useEarnings() {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useQuery({
    queryKey: earningsQueryKey,
    enabled: ready && authenticated,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw missingTokenError();
      return getEarnings(accessToken);
    },
  });
}

export function useEarningsChart(period: EarningsPeriod = "daily") {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useQuery({
    queryKey: [...earningsChartQueryKey, period],
    enabled: ready && authenticated,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw missingTokenError();
      return getEarningsChart(accessToken, period);
    },
  });
}

export function useEarningsSpenders() {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useQuery({
    queryKey: earningsSpendersQueryKey,
    enabled: ready && authenticated,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw missingTokenError();
      return getEarningsSpenders(accessToken);
    },
  });
}
