import type { Context } from "hono";
import { eq, isNotNull } from "drizzle-orm";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { z } from "zod";

import { db } from "../db";
import { users } from "../db/schema";
import type { AppEnv } from "../types/app";
import { USDC_DEVNET } from "../lib/meteora/creator-token-config";

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const portfolioHistoryRangeSchema = z.enum(["1d", "7d", "30d"]).default("7d");

function getUsdcAmount(tokenAccounts: Awaited<ReturnType<Connection["getParsedTokenAccountsByOwner"]>>) {
  return tokenAccounts.value.reduce((total, account) => {
    const info = account.account.data.parsed?.info as { mint?: string; tokenAmount?: { uiAmountString?: string } } | undefined;
    return info?.mint === USDC_DEVNET.toBase58()
      ? total + Number(info?.tokenAmount?.uiAmountString ?? 0)
      : total;
  }, 0);
}

function getUsdcDelta(transaction: Awaited<ReturnType<Connection["getParsedTransactions"]>>[number] | undefined, walletAddress: string, usdcAccounts: Set<string>) {
  if (!transaction?.meta) return 0;
  const accountKeys = transaction.transaction.message.accountKeys.map((account) => account.pubkey.toBase58());
  const amountByAccount = (balances: typeof transaction.meta.preTokenBalances) => new Map(
    (balances ?? [])
      .filter((balance) => balance.mint === USDC_DEVNET.toBase58() && (balance.owner === walletAddress || usdcAccounts.has(accountKeys[balance.accountIndex] ?? "")))
      .map((balance) => [balance.accountIndex, Number(balance.uiTokenAmount.uiAmountString ?? 0)]),
  );
  const pre = amountByAccount(transaction.meta.preTokenBalances);
  const post = amountByAccount(transaction.meta.postTokenBalances);
  const indexes = new Set([...pre.keys(), ...post.keys()]);
  let delta = 0;
  for (const index of indexes) delta += (post.get(index) ?? 0) - (pre.get(index) ?? 0);
  return delta;
}

export async function getMyPortfolio(c: Context<AppEnv>) {
  const walletAddress = c.get("walletAddress");
  if (!walletAddress) return c.json({ success: false, message: "Your Solana wallet is not ready" }, 400);

  try {
    const owner = new PublicKey(walletAddress);
    const connection = new Connection(RPC_URL, "confirmed");
    const [solLamports, tokenAccounts, creatorUsers] = await Promise.all([
      connection.getBalance(owner, "confirmed"),
      connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }, "confirmed"),
      db.select({ username: users.username, name: users.name, avatar: users.avatar, token: users.token, poolAddress: users.poolAddress }).from(users).where(isNotNull(users.token)),
    ]);

    const creatorsByMint = new Map(
      creatorUsers.filter((creator) => creator.token && creator.poolAddress).map((creator) => [creator.token as string, creator]),
    );
    const client = new DynamicBondingCurveClient(connection, "confirmed");
    const priceByMint = new Map<string, number>([[USDC_DEVNET.toBase58(), 1]]);
    const poolPrices = await Promise.all(
      [...creatorUsers].filter((creator) => creator.token).map(async (creator) => {
        const mint = creator.token as string;
        try {
          const discovered = await client.state.getPoolByBaseMint(new PublicKey(mint));
          if (!discovered) return [mint, 0] as const;
          const poolAddress = discovered.publicKey.toBase58();
          if (poolAddress !== creator.poolAddress) {
            await db.update(users).set({ poolAddress, updatedAt: new Date() }).where(eq(users.token, mint));
          }
          creatorsByMint.set(mint, { ...creator, poolAddress });
          const baseReserve = Number(discovered.account.poolState.baseReserve.toString());
          const quoteReserve = Number(discovered.account.poolState.quoteReserve.toString());
          const price = baseReserve > 0 ? quoteReserve / baseReserve : 0;
          return [mint, Number.isFinite(price) ? price : 0] as const;
        } catch {
          return [mint, 0] as const;
        }
      }),
    );
    for (const [mint, price] of poolPrices) priceByMint.set(mint, price);

    const holdings = tokenAccounts.value.flatMap((account) => {
      const parsed = account.account.data.parsed?.info as {
        mint?: string;
        tokenAmount?: { amount?: string; decimals?: number; uiAmountString?: string };
      } | undefined;
      const mint = parsed?.mint;
      const amount = Number(parsed?.tokenAmount?.uiAmountString ?? 0);
      if (!mint || !Number.isFinite(amount) || amount <= 0) return [];
      const creator = creatorsByMint.get(mint);
      const price = priceByMint.get(mint) ?? 0;
      const isUsdc = mint === USDC_DEVNET.toBase58();
      return [{
        mint,
        name: isUsdc ? "USD Coin" : creator?.name || creator?.username || "Unknown token",
        symbol: isUsdc ? "USDC" : (creator?.username ?? mint.slice(0, 6)).slice(0, 8).toUpperCase(),
        image: creator?.avatar ?? "",
        amount,
        decimals: parsed?.tokenAmount?.decimals ?? 0,
        price,
        value: amount * price,
        username: creator?.username ?? null,
      }];
    }).sort((a, b) => b.value - a.value);

    c.header("Cache-Control", "no-store, max-age=0");
    return c.json({
      success: true,
      walletAddress,
      solBalance: solLamports / 1_000_000_000,
      totalValue: holdings.reduce((total, holding) => total + holding.value, 0),
      holdings,
      timestamp: Date.now(),
    }, 200);
  } catch (error) {
    console.error("Get portfolio error:", error);
    return c.json({ success: false, message: "Failed to load wallet portfolio" }, 500);
  }
}

export async function getMyPortfolioHistory(c: Context<AppEnv>) {
  const walletAddress = c.get("walletAddress");
  if (!walletAddress) return c.json({ success: false, message: "Your Solana wallet is not ready" }, 400);

  try {
    const range = portfolioHistoryRangeSchema.parse(c.req.query("range"));
    const owner = new PublicKey(walletAddress);
    const connection = new Connection(RPC_URL, "confirmed");
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }, "confirmed");
    const currentBalance = getUsdcAmount(tokenAccounts);
    const usdcAccounts = new Set(tokenAccounts.value
      .filter((account) => {
        const info = account.account.data.parsed?.info as { mint?: string } | undefined;
        return info?.mint === USDC_DEVNET.toBase58();
      })
      .map((account) => account.pubkey.toBase58()));
    const rangeMs = range === "1d" ? 24 * 60 * 60 * 1000 : range === "7d" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - rangeMs;
    const signatures = await connection.getSignaturesForAddress(owner, { limit: 200 }, "confirmed");
    const relevant = signatures.filter((item) => item.blockTime && item.blockTime * 1000 >= cutoff && !item.err);
    const transactions = await connection.getParsedTransactions(relevant.map((item) => item.signature), { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    let balanceAfter = currentBalance;
    const points = relevant
      .map((signature, index) => ({ time: (signature.blockTime ?? 0) * 1000, delta: getUsdcDelta(transactions[index], walletAddress, usdcAccounts) }))
      .filter((point) => point.time > 0)
      .sort((a, b) => b.time - a.time)
      .map((point) => {
        const result = { time: point.time, amount: Math.max(0, balanceAfter) };
        balanceAfter -= point.delta;
        return result;
      })
      .sort((a, b) => a.time - b.time);

    const bucketed = new Map<string, { period: string; amount: number }>();
    for (const point of points) {
      const date = new Date(point.time);
      const key = range === "1d"
        ? `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`
        : `${date.getMonth() + 1}/${date.getDate()}`;
      bucketed.set(key, { period: key, amount: Number(point.amount.toFixed(6)) });
    }
    const currentKey = range === "1d" ? "Now" : "Today";
    bucketed.set(currentKey, { period: currentKey, amount: Number(currentBalance.toFixed(6)) });
    return c.json({ success: true, range, points: [...bucketed.values()] }, 200);
  } catch (error) {
    console.error("Get portfolio history error:", error);
    return c.json({ success: false, message: "Failed to load portfolio history" }, 500);
  }
}
