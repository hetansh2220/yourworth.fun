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
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
  type WatchlistMutationResult,
} from "@/utils/api/watchlists";

export const watchlistQueryKey = ["watchlist"] as const;

function missingTokenError() {
  return new Error("Your session is unavailable. Please try again.");
}

export function useWatchlist(
  options?: Omit<
    UseQueryOptions<WatchlistItem[], Error, WatchlistItem[], typeof watchlistQueryKey>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useQuery({
    ...options,
    queryKey: watchlistQueryKey,
    enabled: ready && authenticated && (options?.enabled ?? true),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw missingTokenError();
      return getWatchlist(accessToken);
    },
  });
}

export function useAddToWatchlist(
  options?: Omit<
    UseMutationOptions<WatchlistMutationResult, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  const { getAccessToken } = usePrivy();

  return useMutation({
    ...options,
    mutationFn: async (watchedUserId: string) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw missingTokenError();
      return addToWatchlist(accessToken, watchedUserId);
    },
    onSuccess: async (result, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: watchlistQueryKey });
      await options?.onSuccess?.(result, variables, onMutateResult, context);
    },
  });
}

export function useRemoveFromWatchlist(
  options?: Omit<
    UseMutationOptions<WatchlistMutationResult, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  const { getAccessToken } = usePrivy();

  return useMutation({
    ...options,
    mutationFn: async (watchedUserId: string) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw missingTokenError();
      return removeFromWatchlist(accessToken, watchedUserId);
    },
    onSuccess: async (result, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: watchlistQueryKey });
      await options?.onSuccess?.(result, variables, onMutateResult, context);
    },
  });
}
