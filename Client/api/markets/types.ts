import type { ApiSuccess } from "../api-client";

export type MarketType = "dm" | "group";
export type PaymentType = "usdc" | "token";

export type MarketUser = {
  id: string;
  username: string;
  avatar: string;
  bio: string;
};

export type Market = {
  id: string;
  marketType: MarketType;
  paymentType: PaymentType;
  createdAt: string;
  updatedAt: string;
  user: MarketUser;
};

export type MarketInput = {
  marketType: MarketType;
  paymentType: PaymentType;
};

export type GetMarketsParams = {
  limit?: number;
  cursor?: string | null;
  marketType?: MarketType | null;
};

export type GetMyMarketsParams = {
  marketType?: MarketType | null;
};

export type MarketResponse = ApiSuccess<{
  message?: string;
  market: Market;
}>;

export type MarketsResponse = ApiSuccess<{
  markets: Market[];
  nextCursor?: string | null;
}>;
