import { USDC_MINT } from "@/constants";
import connection from "@/lib/connection";
import { unpackAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

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

export type BalancesResponse = {
  balances: TokenBalance[];
  /** Total USD value on this page, not the entire wallet. */
  totalUsdValue: number;
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
};

export type BalancesOptions = {
  page?: number;
  limit?: number;
};

async function getBalances(
  address: string,
  { page = 1, limit = 100 }: BalancesOptions = {},
): Promise<BalancesResponse> {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error("Page must be a positive integer");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Limit must be an integer between 1 and 100");
  }

  const apiKey = process.env.HELIUS_API_KEY;

  if (!apiKey) throw new Error("Missing HELIUS_API_KEY");

  const url = new URL(
    `https://api.helius.xyz/v1/wallet/${encodeURIComponent(address)}/balances`,
  );

  url.search = new URLSearchParams({
    "api-key": apiKey,
    page: String(page),
    limit: String(limit),
  }).toString();

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch wallet balances (${response.status})`);
  }

  return (await response.json()) as BalancesResponse;
}

async function getUsdcBalance(address: string | PublicKey): Promise<number> {
  const owner = typeof address === "string" ? new PublicKey(address) : address;
  const accounts = await connection.getTokenAccountsByOwner(
    owner,
    { mint: new PublicKey(USDC_MINT) },
    "confirmed",
  );

  const amount = accounts.value.reduce(
    (total, account) =>
      total + unpackAccount(account.pubkey, account.account).amount,
    0n,
  );

  return Number(amount) / 1_000_000;
}

export { getBalances, getUsdcBalance };
