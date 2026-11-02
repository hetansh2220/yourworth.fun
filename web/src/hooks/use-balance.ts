"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { getBalance } from "@/utils/api/balance";

export const balanceQueryKey = ["balance"] as const;

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
