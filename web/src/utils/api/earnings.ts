import { api } from "@/lib/api";

export type EarningsPeriod = "daily" | "weekly" | "monthly";
export type EarningsResponse = { success: true; earnings: number };

export type EarningsChartPoint = {
  period: string;
  amount: number;
};

export type EarningsChartResponse = {
  success: true;
  points: EarningsChartPoint[];
};

export type EarningSpender = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  verified: boolean;
  amount: string;
};

export type EarningsSpendersResponse = {
  success: true;
  spenders: EarningSpender[];
};

async function requestEarnings<T>(endpoint: string, accessToken: string) {
  console.log(`[earnings] GET ${endpoint}`);
  try {
    const response = await api<T>(endpoint, { accessToken });
    console.log(`[earnings] response ${endpoint}`, response);
    return response;
  } catch (error) {
    console.error(`[earnings] error ${endpoint}`, error);
    throw error;
  }
}

export function getEarningsChart(
  accessToken: string,
  period: EarningsPeriod = "daily",
) {
  return requestEarnings<EarningsChartResponse>(
    `/earnings/chart?period=${period}`,
    accessToken,
  );
}

export function getEarnings(accessToken: string) {
  return requestEarnings<EarningsResponse>("/earnings", accessToken);
}

export function getEarningsSpenders(accessToken: string) {
  return requestEarnings<EarningsSpendersResponse>(
    "/earnings/spenders",
    accessToken,
  );
}
