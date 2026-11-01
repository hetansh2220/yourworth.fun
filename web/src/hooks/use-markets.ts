"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import {
  createMarkets,
  getMarket,
  getMyMarkets,
  updateMarkets,
  type Market,
  type MarketInput,
} from "@/utils/api/markets";

export const myMarketsQueryKey = ["markets", "me"] as const;
export const marketQueryKey = (marketId: string) => ["market", marketId] as const;

function missingTokenError() {
  return new Error("Your session is unavailable. Please try again.");
}

export function useMyMarkets(
  options?: Omit<
    UseQueryOptions<Market[], Error>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useQuery({
    ...options,
    queryKey: myMarketsQueryKey,
    enabled: ready && authenticated && (options?.enabled ?? true),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw missingTokenError();
      return getMyMarkets(accessToken);
    },
  });
}

export function useMarket(
  marketId: string | undefined,
  options?: Omit<
    UseQueryOptions<Market, Error>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  return useQuery({
    ...options,
    queryKey: marketQueryKey(marketId ?? ""),
    enabled: Boolean(marketId) && (options?.enabled ?? true),
    queryFn: () => getMarket(marketId!),
  });
}

export function useCreateMarkets(
  options?: Omit<
    UseMutationOptions<Market[], Error, MarketInput[]>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  const { getAccessToken } = usePrivy();

  return useMutation({
    ...options,
    mutationFn: async (input: MarketInput[]) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw missingTokenError();
      return createMarkets(accessToken, input);
    },
    onSuccess: async (markets, variables, onMutateResult, context) => {
      queryClient.setQueryData(myMarketsQueryKey, markets);
      await queryClient.invalidateQueries({ queryKey: myMarketsQueryKey });
      await options?.onSuccess?.(markets, variables, onMutateResult, context);
    },
  });
}

export function useUpdateMarkets(
  options?: Omit<
    UseMutationOptions<Market[], Error, MarketInput[]>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  const { getAccessToken } = usePrivy();

  return useMutation({
    ...options,
    mutationFn: async (input: MarketInput[]) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw missingTokenError();
      return updateMarkets(accessToken, input);
    },
    onSuccess: async (markets, variables, onMutateResult, context) => {
      queryClient.setQueryData(myMarketsQueryKey, markets);
      await queryClient.invalidateQueries({ queryKey: myMarketsQueryKey });
      await options?.onSuccess?.(markets, variables, onMutateResult, context);
    },
  });
}
