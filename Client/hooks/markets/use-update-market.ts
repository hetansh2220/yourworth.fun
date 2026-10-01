"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { marketsApi, type MarketInput } from "@/api/markets";
import { requireAccessToken } from "@/hooks/users/require-access-token";
import { marketKeys } from "./market-keys";

export function useUpdateMarket() {
  const queryClient = useQueryClient();
  const { getAccessToken } = usePrivy();

  return useMutation({
    mutationFn: async (input: MarketInput) => {
      const token = await requireAccessToken(getAccessToken);
      return marketsApi.updateMarket(input, token);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(marketKeys.detail(response.market.id), response);
      void queryClient.invalidateQueries({ queryKey: marketKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: marketKeys.mineRoot() });
    },
  });
}
