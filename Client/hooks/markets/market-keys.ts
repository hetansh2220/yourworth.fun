import type { GetMarketsParams, GetMyMarketsParams } from "@/api/markets";

export const marketKeys = {
  all: ["markets"] as const,
  lists: () => [...marketKeys.all, "list"] as const,
  list: (params: GetMarketsParams = {}) => [...marketKeys.lists(), params] as const,
  detail: (id: string) => [...marketKeys.all, "detail", id] as const,
  mineRoot: () => [...marketKeys.all, "mine"] as const,
  mine: (params: GetMyMarketsParams = {}) => [...marketKeys.mineRoot(), params] as const,
};
