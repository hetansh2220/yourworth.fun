import { unpackAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import type { Context } from "hono";
import { z } from "zod";

import { USDC_MINT } from "@/constants";
import connection from "@/lib/connection";
import type { AppEnv } from "@/types/app";

type TokenBalance = {
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

type HoldingsResponse = {
  balances: TokenBalance[];
  totalUsdValue: number;
  pagination: { page: number; limit: number; hasMore: boolean };
};

const chartPeriodSchema = z.enum(["daily", "weekly", "monthly"]);

const zerionPeriod = {
  daily: "day",
  weekly: "week",
  monthly: "month",
} as const;

type WalletBalanceChartResponse = {
  data: {
    attributes: {
      points: [timestamp: number, balance: number][];
    };
  };
};

/** GET /portfolio/balance. Returns the authenticated wallet's USDC balance. */
export async function getPortfolioBalance(c: Context<AppEnv>) {
  try {
    const owner = new PublicKey(c.get("walletAddress"));
    const accounts = await connection.getTokenAccountsByOwner(
      owner,
      { mint: new PublicKey(USDC_MINT) },
      "confirmed",
    );
    const rawBalance = accounts.value.reduce(
      (total, account) =>
        total + unpackAccount(account.pubkey, account.account).amount,
      0n,
    );

    return c.json({ success: true, balance: Number(rawBalance) / 1_000_000 });
  } catch (error) {
    console.error("Get portfolio balance error:", error);
    return c.json(
      { success: false, message: "Failed to retrieve USDC balance" },
      500,
    );
  }
}

/** GET /portfolio/holdings?page=1&limit=100. */
export async function getHoldings(c: Context<AppEnv>) {
  const page = Number(c.req.query("page") ?? "1");
  const limit = Number(c.req.query("limit") ?? "100");
  if (!Number.isSafeInteger(page) || page < 1) {
    return c.json(
      { success: false, message: "page must be a positive integer" },
      400,
    );
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return c.json(
      { success: false, message: "limit must be an integer between 1 and 100" },
      400,
    );
  }

  const address = c.get("walletAddress");
  const apiKey = process.env.HELIUS_API_KEY?.trim();
  if (!apiKey) {
    return c.json({ success: false, message: "Missing HELIUS_API_KEY" }, 500);
  }

  try {
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
      console.error("Helius holdings request failed:", response.status);
      return c.json(
        { success: false, message: "Failed to fetch wallet holdings" },
        502,
      );
    }

    const holdings = (await response.json()) as HoldingsResponse;
    return c.json({ success: true, ...holdings });
  } catch (error) {
    console.error("Get wallet holdings error:", error);
    return c.json(
      { success: false, message: "Failed to retrieve wallet holdings" },
      500,
    );
  }
}

/** GET /portfolio/chart?period=daily|weekly|monthly (defaults to daily). */
export async function getWalletBalanceChart(c: Context<AppEnv>) {
  const parsedPeriod = chartPeriodSchema.safeParse(
    c.req.query("period") ?? "daily",
  );
  if (!parsedPeriod.success) {
    return c.json(
      { success: false, message: "period must be daily, weekly, or monthly" },
      400,
    );
  }

  const address = c.get("walletAddress").trim();
  const apiKey = process.env.ZERION_API_KEY?.trim();
  if (!apiKey) {
    return c.json({ success: false, message: "Missing ZERION_API_KEY" }, 500);
  }

  try {
    const url = new URL(
      `https://api.zerion.io/v1/wallets/${encodeURIComponent(address)}/charts/${zerionPeriod[parsedPeriod.data]}`,
    );
    url.search = new URLSearchParams({
      currency: "usd",
      "filter[positions]": "only_simple",
    }).toString();

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      console.error("Zerion wallet chart request failed:", response.status);
      return c.json(
        { success: false, message: "Failed to fetch wallet balance chart" },
        502,
      );
    }

    const chart = (await response.json()) as WalletBalanceChartResponse;
    return c.json({ success: true, points: chart.data.attributes.points });
  } catch (error) {
    console.error("Get wallet balance chart error:", error);
    return c.json(
      { success: false, message: "Failed to fetch wallet balance chart" },
      500,
    );
  }
}
