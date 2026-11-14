"use client";

import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import type { PreparedSwap, SwapInput } from "@/hooks/market-swap-types";
import { buy as buyFromJupiter } from "@/utils/jupiter";
import { buy as buyFromMeteora, isMigrated } from "@/utils/meteora";

export function useBuy(
  options?: Omit<
    UseMutationOptions<PreparedSwap, Error, SwapInput>,
    "mutationFn"
  >,
) {
  const { data: profile } = useProfile();

  return useMutation({
    ...options,
    mutationFn: async (input): Promise<PreparedSwap> => {
      const migrated = await isMigrated(input.tokenMint);
      const walletAddress = profile?.address;
      if (!walletAddress)
        throw new Error("Your profile wallet address is unavailable");

      if (migrated) {
        return buyFromJupiter(input, {
          walletAddress,
        });
      }

      return buyFromMeteora(input, {
        walletAddress,
      });
    },
  });
}
