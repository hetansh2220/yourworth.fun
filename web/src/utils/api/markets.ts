import { api } from "@/lib/api";

export type MarketType = "DM" | "GROUP";
export type PaymentType = "USDC" | "CREATOR_TOKEN";

export type Market = {
  id: string;
  userId: string;
  marketType: MarketType;
  paymentType: PaymentType;
  amount: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketInput = {
  marketType: MarketType;
  paymentType: PaymentType;
  amount: number;
};

export type MarketsResponse = {
  success: true;
  markets: Market[];
};

export type MarketResponse = {
  success: true;
  market: Market;
};

export async function getMyMarkets(accessToken: string): Promise<Market[]> {
  const response = await api<MarketsResponse>("/markets", { accessToken });
  return response.markets;
}

export async function createMarkets(
  accessToken: string,
  input: MarketInput[],
): Promise<Market[]> {
  const response = await api<MarketsResponse>("/markets", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.markets;
}

export async function updateMarkets(
  accessToken: string,
  input: MarketInput[],
): Promise<Market[]> {
  const response = await api<MarketsResponse>("/markets", {
    method: "PATCH",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.markets;
}

export async function getMarket(
  marketId: string,
): Promise<Market> {
  const response = await api<MarketResponse>(
    `/markets/${encodeURIComponent(marketId)}`,
  );
  return response.market;
}
