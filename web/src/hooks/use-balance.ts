"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import {
  getBalance,
  getBalances,
  type WalletBalancesResponse,
} from "@/utils/api/balance";

export const balanceQueryKey = ["balance"] as const;
export const balancesQueryKey = ["balances"] as const;

export function useBalance() {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useQuery({
    queryKey: balanceQueryKey,
    enabled: ready && authenticated,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Your session is unavailable. Please try again.");
      }
      return getBalance(accessToken);
    },
  });
}

export function useBalances(
  options: {
    page?: number;
    limit?: number;
    queryOptions?: Omit<
      UseQueryOptions<WalletBalancesResponse, Error>,
      "queryKey" | "queryFn"
    >;
  } = {},
) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const page = options.page ?? 1;
  const limit = options.limit ?? 100;

  return useQuery({
    ...options.queryOptions,
    queryKey: [...balancesQueryKey, page, limit],
    enabled:
      ready && authenticated && (options.queryOptions?.enabled ?? true),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Your session is unavailable. Please try again.");
      }
      return getBalances(accessToken, { page, limit });
    },
  });
}
