"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { marketsApi, type GetMyMarketsParams } from "@/api/markets";
import { requireAccessToken } from "@/hooks/users/require-access-token";
import { marketKeys } from "./market-keys";

export function useMyMarkets(params: GetMyMarketsParams = {}) {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useQuery({
    queryKey: marketKeys.mine(params),
    queryFn: async () => {
      const token = await requireAccessToken(getAccessToken);
      return marketsApi.getMyMarkets(params, token);
    },
    enabled: ready && authenticated,
  });
}
