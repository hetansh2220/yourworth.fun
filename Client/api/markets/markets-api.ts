import { apiFetch } from "../api-client";
import type {
  GetMarketsParams,
  GetMyMarketsParams,
  MarketInput,
  MarketResponse,
  MarketsResponse,
} from "./types";

function createMarketsQuery(params: GetMarketsParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.limit) {
    searchParams.set("limit", String(params.limit));
  }

  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  }

  if (params.marketType) {
    searchParams.set("marketType", params.marketType);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function createMyMarketsQuery(params: GetMyMarketsParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.marketType) {
    searchParams.set("marketType", params.marketType);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export const marketsApi = {
  getMarkets(params: GetMarketsParams = {}) {
    return apiFetch<MarketsResponse>(`/markets${createMarketsQuery(params)}`);
  },

  getMarket(id: string) {
    return apiFetch<MarketResponse>(`/markets/${id}`);
  },

  getMyMarkets(params: GetMyMarketsParams = {}, token: string) {
    return apiFetch<MarketsResponse | MarketResponse>(
      `/markets/me${createMyMarketsQuery(params)}`,
      { token }
    );
  },

  createMarket(input: MarketInput, token: string) {
    return apiFetch<MarketResponse>("/markets", {
      method: "POST",
      body: input,
      token,
    });
  },

  updateMarket(input: MarketInput, token: string) {
    return apiFetch<MarketResponse>("/markets/me", {
      method: "PATCH",
      body: input,
      token,
    });
  },
};
