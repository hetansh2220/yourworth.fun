import type { Context } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Connection, PublicKey } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";

import { db } from "../db";
import { dmRequests, reviews, users } from "../db/schema";
import type { AppEnv } from "../types/app";
import { getLaunchWalletAddress } from "../lib/meteora/creator-token-launch";

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
let reviewsTableUnavailable = false;

async function getCurrentUser(walletAddress: string) {
  const [user] = await db.select().from(users).where(eq(users.address, walletAddress)).limit(1);
  return user;
}

function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function addToBucket(buckets: Map<string, number>, date: Date, amount: number) {
  const key = date.toISOString().slice(0, 10);
  buckets.set(key, (buckets.get(key) ?? 0) + amount);
}

function chartBuckets(buckets: Map<string, number>, days: number) {
  const now = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - index - 1));
    const key = date.toISOString().slice(0, 10);
    return {
      period: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount: Number((buckets.get(key) ?? 0).toFixed(6)),
    };
  });
}

export async function getMyEarnings(c: Context<AppEnv>) {
  try {
    const creator = await getCurrentUser(c.get("walletAddress"));
    if (!creator) return c.json({ success: false, message: "Create your user profile first" }, 404);

    const completedRequests = await db
      .select({ amount: dmRequests.amount, userId: dmRequests.userId, createdAt: dmRequests.createdAt })
      .from(dmRequests)
      .where(and(eq(dmRequests.creatorId, creator.id), eq(dmRequests.status, "COMPLETED")))
      .orderBy(desc(dmRequests.createdAt));

    let tokenPrice = 0;
    let supply = 0;
    let poolAddress = creator.poolAddress;
    let pool: Awaited<ReturnType<DynamicBondingCurveClient["state"]["getPoolByBaseMint"]>> = null;
    const connection = creator.token ? new Connection(RPC_URL, "confirmed") : null;
    let largestAccounts: Awaited<ReturnType<Connection["getTokenLargestAccounts"]>> = { context: { slot: 0 }, value: [] };

    if (creator.token && connection) {
      const client = new DynamicBondingCurveClient(connection, "confirmed");
      pool = await client.state.getPoolByBaseMint(new PublicKey(creator.token)).catch(() => null);
      if (pool) {
        poolAddress = pool.publicKey.toBase58();
        const baseReserve = Number(pool.account.poolState.baseReserve.toString());
        const quoteReserve = Number(pool.account.poolState.quoteReserve.toString());
        tokenPrice = baseReserve > 0 ? quoteReserve / baseReserve : 0;
      }
      const [supplyResult, largestResult] = await Promise.all([
        connection.getTokenSupply(new PublicKey(creator.token), "confirmed"),
        connection.getTokenLargestAccounts(new PublicKey(creator.token), "confirmed").catch(() => ({ context: { slot: 0 }, value: [] })),
      ]);
      supply = supplyResult.value.uiAmount ?? 0;
      largestAccounts = largestResult;
    }

    const earningsByDay = new Map<string, number>();
    const spenderTotals = new Map<string, number>();
    let totalEarnings = 0;

    for (const request of completedRequests) {
      const tokenAmount = Number(request.amount) / 1_000_000;
      const usdAmount = tokenAmount * tokenPrice;
      totalEarnings += usdAmount;
      addToBucket(earningsByDay, request.createdAt, usdAmount);
      spenderTotals.set(request.userId, (spenderTotals.get(request.userId) ?? 0) + usdAmount);
    }

    const spenderIds = [...spenderTotals.keys()];
    const spenderRows = spenderIds.length
      ? await db.select({ id: users.id, name: users.name, username: users.username, walletAddress: users.address }).from(users).where(inArray(users.id, spenderIds))
      : [];
    const spenderById = new Map(spenderRows.map((spender) => [spender.id, spender]));
    const spenders = spenderIds
      .map((id) => {
        const spender = spenderById.get(id);
        if (!spender) return null;
        return {
          name: spender.name || spender.username,
          initials: (spender.name || spender.username).slice(0, 2).toUpperCase(),
          wallet: shortAddress(spender.walletAddress),
          amount: Number((spenderTotals.get(id) ?? 0).toFixed(6)),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    let holders: Array<{ name: string; initials: string; wallet: string; amount: number }> = [];
    if (creator.token && connection) {
      const poolVaults = new Set<string>();
      const excludedHolders = new Set<string>();
      if (pool) {
        poolVaults.add(pool.account.poolState.baseVault.toBase58());
        poolVaults.add(pool.account.poolState.quoteVault.toBase58());
      }
      try {
        excludedHolders.add(await getLaunchWalletAddress());
      } catch {
        // Holder analytics should still work if the launch wallet is not
        // available in a read-only server environment.
      }
      // Meteora's pool vault is normally the largest token account. It is
      // liquidity, not a user holding, so it must not appear in the holder
      // leaderboard.
      const tokenAccounts = largestAccounts.value
        .filter((entry) => !poolVaults.has(entry.address.toBase58()) && BigInt(entry.amount) > 0n)
        .slice(0, 10);
      const parsedAccounts = await connection.getMultipleParsedAccounts(tokenAccounts.map((entry) => entry.address), { commitment: "confirmed" }).catch(() => ({ value: [] }));
      const owners = tokenAccounts.map((entry, index) => {
        const account = parsedAccounts.value[index];
        const data = account?.data;
        const info = data && "parsed" in data ? (data.parsed as { info?: { owner?: string } }).info : undefined;
        return { entry, owner: info?.owner ?? entry.address.toBase58() };
      });
      const ownerAddresses = owners
        .map((item) => item.owner)
        .filter((owner) => !excludedHolders.has(owner));
      const ownerUsers = ownerAddresses.length
        ? await db.select({ walletAddress: users.address, name: users.name, username: users.username }).from(users).where(inArray(users.address, ownerAddresses))
        : [];
      const ownerMap = new Map(ownerUsers.map((owner) => [owner.walletAddress, owner]));
      holders = owners.filter(({ owner }) => !excludedHolders.has(owner)).map(({ entry, owner }) => {
        const user = ownerMap.get(owner);
        const name = user?.name || user?.username || shortAddress(owner);
        return { name, initials: name.slice(0, 2).toUpperCase(), wallet: shortAddress(owner), amount: Number(entry.uiAmountString ?? 0) };
      }).sort((a, b) => b.amount - a.amount).slice(0, 5);
    }

    // Reviews are optional analytics. Older databases may not have the
    // reviews table yet, so never let that prevent earnings from loading.
    let allReviews: Array<{ rating: number }> = [];
    if (!reviewsTableUnavailable) {
      try {
        allReviews = await db
          .select({ rating: reviews.rating })
          .from(reviews)
          .where(eq(reviews.reviewedUserId, creator.id));
      } catch (error) {
        // The schema may be deployed before its migration. Avoid retrying the
        // same failing query on every earnings poll until the server restarts.
        reviewsTableUnavailable = true;
        console.warn("Reviews table unavailable; run the database migration to enable review analytics.");
      }
    }
    const averageRating = allReviews.length ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length : 0;

    return c.json({
      success: true,
      earnings: {
        totalEarnings: Number(totalEarnings.toFixed(6)),
        todayEarnings: chartBuckets(earningsByDay, 1)[0]?.amount ?? 0,
        periods: [
          { value: "daily", label: "Daily", data: chartBuckets(earningsByDay, 7) },
          { value: "weekly", label: "Weekly", data: chartBuckets(earningsByDay, 7) },
          { value: "monthly", label: "Monthly", data: chartBuckets(earningsByDay, 30) },
        ],
        tokenPrice,
        holderCount: holders.length,
        marketCap: tokenPrice * supply,
        supply,
        token: creator.token,
        poolAddress,
        dmCount: completedRequests.length,
        totalTradingVolume: 0,
        totalMinuteVolume: 0,
        profileViews: 0,
        referrals: 0,
        averageRating,
        reviewCount: allReviews.length,
        holders,
        spenders,
      },
    }, 200);
  } catch (error) {
    console.error("Get earnings error:", error);
    return c.json({ success: false, message: "Failed to load earnings" }, 500);
  }
}
