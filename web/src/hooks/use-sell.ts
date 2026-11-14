"use client";

import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import type { PreparedSwap, SwapInput } from "@/hooks/market-swap-types";
import { sell as sellFromJupiter } from "@/utils/jupiter";
import { isMigrated, sell as sellFromMeteora } from "@/utils/meteora";

export function useSell(
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
      if (!walletAddress) throw new Error("Your profile wallet address is unavailable");

      if (migrated) {
        return sellFromJupiter(input, {
          walletAddress,
        });
      }

      return sellFromMeteora(input, {
        walletAddress,
      });
    },
  });
}
