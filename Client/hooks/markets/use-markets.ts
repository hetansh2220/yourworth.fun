"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { marketsApi, type GetMarketsParams } from "@/api/markets";
import { marketKeys } from "./market-keys";

export function useMarkets(params: GetMarketsParams = {}) {
  return useInfiniteQuery({
    queryKey: marketKeys.list(params),
    initialPageParam: params.cursor ?? null,
    queryFn: ({ pageParam }) =>
      marketsApi.getMarkets({
        ...params,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
