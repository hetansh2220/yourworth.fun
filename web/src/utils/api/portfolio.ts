import { api } from "@/lib/api";

export type PortfolioBalanceResponse = { success: true; balance: number };
export type TokenBalance = { mint: string; symbol?: string | null; name?: string | null; balance: number; balanceRaw?: string; decimals: number; usdValue: number | null; pricePerToken: number | null; logoUri?: string | null; tokenProgram: "spl-token" | "token-2022" };
export type PortfolioHoldingsResponse = { success: true; balances: TokenBalance[]; totalUsdValue: number; pagination: { page: number; limit: number; hasMore: boolean } };
export type PortfolioStatsResponse = { success: true; referralsCount: number; reviewsCount: number };
export type PortfolioChartPeriod = "daily" | "weekly" | "monthly";
export type PortfolioChartResponse = { success: true; points: [timestamp: number, balance: number][] };

async function requestPortfolio<T>(endpoint: string, accessToken: string) {
  console.log(`[portfolio] GET ${endpoint}`);
  try {
    const response = await api<T>(endpoint, { accessToken });
    console.log(`[portfolio] response ${endpoint}`, response);
    return response;
  } catch (error) {
    console.error(`[portfolio] error ${endpoint}`, error);
    throw error;
  }
}

export async function getPortfolioBalance(accessToken: string) {
  const response = await requestPortfolio<PortfolioBalanceResponse>("/portfolio/balance", accessToken);
  console.log("[portfolio] balance", response.balance);
  return response.balance;
}

export async function getPortfolioHoldings(accessToken: string, options: { page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.page !== undefined) params.set("page", String(options.page));
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  const query = params.toString();
  return requestPortfolio<PortfolioHoldingsResponse>(`/portfolio/holdings${query ? `?${query}` : ""}`, accessToken);
}

export function getPortfolioStats(accessToken: string) {
  return requestPortfolio<PortfolioStatsResponse>("/portfolio/stats", accessToken);
}

export function getPortfolioChart(accessToken: string, period: PortfolioChartPeriod = "daily") {
  return requestPortfolio<PortfolioChartResponse>(`/portfolio/chart?period=${period}`, accessToken);
}
