"use client";

import { useQuery } from "@tanstack/react-query";
import { marketsApi } from "@/api/markets";
import { marketKeys } from "./market-keys";

export function useMarket(id: string) {
  return useQuery({
    queryKey: marketKeys.detail(id),
    queryFn: () => marketsApi.getMarket(id),
    enabled: id.length > 0,
  });
}
