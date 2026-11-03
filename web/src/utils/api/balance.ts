import { api } from "@/lib/api";

export type BalanceResponse = {
  success: true;
  balance: number;
};

export type TokenBalance = {
  mint: string;
  symbol?: string | null;
  name?: string | null;
  balance: number;
  balanceRaw?: string;
  decimals: number;
  usdValue: number | null;
  pricePerToken: number | null;
  logoUri?: string | null;
  tokenProgram: "spl-token" | "token-2022";
};

export type WalletBalancesResponse = {
  success: true;
  balances: TokenBalance[];
  totalUsdValue: number;
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
};

export async function getBalance(accessToken: string): Promise<number> {
  const response = await api<BalanceResponse>("/users/balance", {
    accessToken,
  });
  return response.balance;
}

export async function getBalances(
  accessToken: string,
  options: { page?: number; limit?: number } = {},
): Promise<WalletBalancesResponse> {
  const params = new URLSearchParams();
  if (options.page !== undefined) params.set("page", String(options.page));
  if (options.limit !== undefined) params.set("limit", String(options.limit));

  const query = params.toString();
  return api<WalletBalancesResponse>(
    `/users/balances${query ? `?${query}` : ""}`,
    { accessToken },
  );
}
