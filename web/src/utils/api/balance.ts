import { api } from "@/lib/api";

export type BalanceResponse = {
  success: true;
  balance: number;
};

export async function getBalance(accessToken: string): Promise<number> {
  const response = await api<BalanceResponse>("/users/balance", {
    accessToken,
  });
  return response.balance;
}
