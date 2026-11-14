"use client";

import { useQuery } from "@tanstack/react-query";
import type { SwapInput, SwapQuote, SwapSide } from "@/hooks/market-swap-types";
import { quote as quoteFromJupiter } from "@/utils/jupiter";
import { isMigrated, quote as quoteFromMeteora } from "@/utils/meteora";

export function useQuote(
  side: SwapSide,
  input: SwapInput | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: [
      "market",
      "quote",
      side,
      input?.tokenMint ?? "",
      input?.amount ?? "",
      input?.slippageBps ?? 100,
    ],
    enabled:
      Boolean(input?.tokenMint && input.amount) && (options.enabled ?? true),
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<SwapQuote> => {
      if (!input) throw new Error("Swap quote input is required");
      const migrated = await isMigrated(input.tokenMint);
      return migrated
        ? quoteFromJupiter(side, input)
        : quoteFromMeteora(side, input);
    },
  });
}
