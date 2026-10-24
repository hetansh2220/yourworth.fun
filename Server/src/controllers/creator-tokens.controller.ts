import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { users } from "../db/schema";
import {
  launchCreatorTokenDevnet,
  settleTradingFeesDevnet,
} from "../lib/meteora/creator-token-launch";
import { prepareCreatorTokenLaunch } from "../lib/meteora/creator-token-launch";
import { Connection, PublicKey, SendTransactionError, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import type { AppEnv } from "../types/app";
import { USDC_DEVNET } from "../lib/meteora/creator-token-config";
import { ensurePrivateGroupForCreator } from "./chats.controller";

const creatorTokenLaunchSchema = z.object({
  name: z.string().trim().min(3).max(32).optional(),
  symbol: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/)
    .optional(),
  description: z.string().trim().max(160).optional(),
  imageUrl: z.string().trim().url().optional(),
  metadataUri: z.string().trim().url().optional(),
});
const confirmCreatorTokenSchema = z.object({
  mintAddress: z.string().trim().min(32).max(44),
  createConfigSignature: z.string().trim().min(32),
  createPoolSignature: z.string().trim().min(32),
});
const prepareSwapSchema = z.object({
  creatorUsername: z.string().trim().min(1).max(20),
  side: z.enum(["buy", "sell"]),
  amountIn: z.string().regex(/^\d+$/),
  minimumAmountOut: z.string().regex(/^\d+$/),
});
const submitSwapSchema = z.object({ signedTransaction: z.string().min(20) });
const settleFeesSchema = z.object({ creatorUsername: z.string().trim().min(1).max(20) });

const chartRangeSchema = z.enum(["1d", "7d", "30d"]).default("1d");

function tokenBalanceAtAddress(
  balances: Array<{ accountIndex: number; uiTokenAmount: { amount: string } }> | null | undefined,
  accountKeys: Array<{ pubkey: PublicKey }>,
  address: string,
) {
  if (!balances) return null;
  const balance = balances.find((item) => accountKeys[item.accountIndex]?.pubkey.toBase58() === address);
  return balance ? BigInt(balance.uiTokenAmount.amount) : null;
}

async function resolveCreatorPool(
  client: DynamicBondingCurveClient,
  creator: { id: string; token: string | null; poolAddress: string | null },
) {
  if (!creator.token) return null;

  // Always resolve from the mint first. A stale poolAddress can still point
  // to a valid DBC pool for a different token, and Meteora would then reject
  // the swap with "Pool not found" or build the wrong accounts.
  try {
    const discovered = await client.state.getPoolByBaseMint(new PublicKey(creator.token));
    if (discovered) {
      const address = discovered.publicKey;
      if (address.toBase58() !== creator.poolAddress) {
        await db
          .update(users)
          .set({ poolAddress: address.toBase58(), updatedAt: new Date() })
          .where(eq(users.id, creator.id));
      }

      return { address, pool: discovered.account };
    }
  } catch (error) {
    console.warn("Creator pool lookup by base mint failed", {
      creatorId: creator.id,
      token: creator.token,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Do not fall back to an unverified stored address: using a valid pool for
  // another mint would be worse than returning a clear unavailable response.
  return null;
}

export async function getCreatorTokenChart(c: Context<AppEnv>) {
  const username = c.req.param("username");
  if (!username) return c.json({ success: false, message: "Username is required" }, 400);

  try {
    const [creator] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!creator?.token) {
      return c.json({ success: false, message: "Creator trading pool is unavailable" }, 404);
    }

    const range = chartRangeSchema.parse(c.req.query("range"));
    const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
    const client = new DynamicBondingCurveClient(connection, "confirmed");
    const resolvedPool = await resolveCreatorPool(client, creator);
    if (!resolvedPool) return c.json({ success: false, message: "Creator pool was not found on-chain" }, 404);
    const { address: poolAddress, pool } = resolvedPool;

    const baseReserve = Number(pool.poolState.baseReserve.toString());
    const quoteReserve = Number(pool.poolState.quoteReserve.toString());
    if (!Number.isFinite(baseReserve) || !Number.isFinite(quoteReserve) || baseReserve <= 0) {
      return c.json({ success: false, message: "Creator pool reserves are unavailable" }, 409);
    }

    // Both the creator token and Devnet USDC use six decimals. The decimal
    // adjustment therefore cancels out and reserve ratio is the USDC price.
    const price = quoteReserve / baseReserve;

    const rangeDays = range === "1d" ? 1 : range === "7d" ? 7 : 30;
    const cutoff = Math.floor(Date.now() / 1000) - rangeDays * 24 * 60 * 60;
    const signatures = await connection.getSignaturesForAddress(poolAddress, { limit: 500 }, "confirmed");
    const historicalSignatures = signatures
      .filter((item) => item.blockTime !== null && item.blockTime !== undefined && item.blockTime >= cutoff)
      .map((item) => item.signature);
    const transactions = await connection.getParsedTransactions(historicalSignatures, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const baseVault = pool.poolState.baseVault.toBase58();
    const quoteVault = pool.poolState.quoteVault.toBase58();
    const points = transactions
      .flatMap((transaction, index) => {
        if (!transaction?.meta || transaction.blockTime === null || transaction.blockTime === undefined) return [];
        const accountKeys = transaction.transaction.message.accountKeys;
        const postBase = tokenBalanceAtAddress(transaction.meta.postTokenBalances, accountKeys, baseVault);
        const postQuote = tokenBalanceAtAddress(transaction.meta.postTokenBalances, accountKeys, quoteVault);
        if (postBase === null || postQuote === null || postBase <= 0n || !historicalSignatures[index]) return [];
        const pointPrice = Number(postQuote) / Number(postBase);
        return Number.isFinite(pointPrice) && pointPrice > 0
          ? [{ time: transaction.blockTime * 1000, price: pointPrice }]
          : [];
      })
      .sort((a, b) => a.time - b.time)
      .slice(-120);

    return c.json({
      success: true,
      username: creator.username,
      token: creator.token,
      poolAddress: poolAddress.toBase58(),
      price,
      timestamp: Date.now(),
      range,
      points,
    }, 200);
  } catch (error) {
    console.error("Get creator token chart error:", error);
    return c.json({ success: false, message: "Failed to load creator token chart" }, 500);
  }
}

export async function submitCreatorTokenSwap(c: Context<AppEnv>) {
  const parsed = submitSwapSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, message: "Invalid signed transaction" }, 400);
  const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  try {
    const rawTransaction = Buffer.from(parsed.data.signedTransaction, "base64");
    const transaction = Transaction.from(rawTransaction);
    const feePayer = transaction.feePayer?.toBase58() ?? "missing";
    const balance = feePayer === "missing" ? null : await connection.getBalance(new PublicKey(feePayer), "confirmed");
    console.log("Swap submit diagnostics", {
      rpc: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
      feePayer,
      balanceLamports: balance,
      balanceSol: balance === null ? null : balance / 1_000_000_000,
      recentBlockhash: transaction.recentBlockhash,
      signatures: transaction.signatures.map((item) => ({
        publicKey: item.publicKey.toBase58(),
        signed: Boolean(item.signature),
      })),
    });
    const signature = await connection.sendRawTransaction(rawTransaction, { skipPreflight: false, maxRetries: 3 });
    await connection.confirmTransaction(signature, "confirmed");
    return c.json({ success: true, signature }, 200);
  } catch (error) {
    console.error("Submit creator token swap error:", error);
    let simulationLogs: string[] | undefined;
    if (error instanceof SendTransactionError) {
      simulationLogs = await error.getLogs(connection).catch(() => undefined);
      console.error("Swap simulation logs:", simulationLogs);
    }
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to submit swap",
      ...(simulationLogs ? { logs: simulationLogs } : {}),
    }, 500);
  }
}

export async function prepareCreatorTokenSwap(c: Context<AppEnv>) {
  const parsed = prepareSwapSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, message: "Invalid swap request" }, 400);
  try {
    const [creator] = await db.select().from(users).where(eq(users.username, parsed.data.creatorUsername)).limit(1);
    const currentUser = await getCurrentUser(c.get("privyUserId"));
    const walletAddress = c.get("walletAddress");
    if (!currentUser) return c.json({ success: false, message: "Create your user profile first" }, 404);
    if (!walletAddress) return c.json({ success: false, message: "Your Solana wallet is not ready" }, 400);
    if (!creator?.token) return c.json({ success: false, message: "Creator trading pool is unavailable" }, 404);
    const owner = new PublicKey(walletAddress);
    const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
    const client = new DynamicBondingCurveClient(connection, "confirmed");
    const resolvedPool = await resolveCreatorPool(client, creator);
    if (!resolvedPool) {
      return c.json({
        success: false,
        message: "Creator pool was not found on-chain. Relaunch the creator token pool.",
      }, 404);
    }
    const { address: poolAddress, pool: poolState } = resolvedPool;
    if (poolState.poolState.quoteReserve.toString() === "0") {
      return c.json({
        success: false,
        message: "This creator pool has no USDC liquidity. Create a new pool with initial liquidity before trading.",
      }, 409);
    }
    const baseMint = poolState.poolState.baseMint;
    const inputMint = parsed.data.side === "sell" ? baseMint : USDC_DEVNET;
    const inputAta = getAssociatedTokenAddressSync(inputMint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const inputBalance = await connection.getTokenAccountBalance(inputAta, "confirmed").catch(() => null);
    const requestedAmount = BigInt(parsed.data.amountIn);
    if (!inputBalance) {
      return c.json({
        success: false,
        message: `Your wallet has no input token account for ${inputMint.toBase58()}.`,
        walletAddress,
        inputMint: inputMint.toBase58(),
      }, 400);
    }
    if (BigInt(inputBalance.value.amount) < requestedAmount) {
      return c.json({
        success: false,
        message: `Insufficient ${parsed.data.side === "sell" ? "creator token" : "USDC"} balance. Wallet ${walletAddress} has ${inputBalance.value.uiAmountString}, but this trade requires ${inputBalance.value.uiAmountString === "0" ? parsed.data.amountIn : "more than the available balance"}.`,
        walletAddress,
        inputMint: inputMint.toBase58(),
        available: inputBalance.value.uiAmountString,
        requestedBaseUnits: parsed.data.amountIn,
      }, 400);
    }
    console.log("Swap prepare diagnostics", {
      walletAddress,
      creatorUsername: parsed.data.creatorUsername,
      poolAddress: poolAddress.toBase58(),
      baseMint: baseMint.toBase58(),
      inputMint: inputMint.toBase58(),
      inputBalance: inputBalance.value.uiAmountString,
      quoteReserve: poolState.poolState.quoteReserve.toString(),
      hasSwap: poolState.poolState.hasSwap,
      side: parsed.data.side,
      amountIn: parsed.data.amountIn,
    });
    const transaction = await client.pool.swap({
      owner,
      payer: owner,
      pool: poolAddress,
      amountIn: new BN(parsed.data.amountIn),
      minimumAmountOut: new BN(parsed.data.minimumAmountOut),
      swapBaseForQuote: parsed.data.side === "sell",
      referralTokenAccount: null,
    });
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = owner;
    transaction.recentBlockhash = blockhash;
    const creatorTokenMint = baseMint;
    const creatorTokenAta = getAssociatedTokenAddressSync(creatorTokenMint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const usdcAta = getAssociatedTokenAddressSync(USDC_DEVNET, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const ataInstructions = [
      createAssociatedTokenAccountIdempotentInstruction(owner, creatorTokenAta, owner, creatorTokenMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
      createAssociatedTokenAccountIdempotentInstruction(owner, usdcAta, owner, USDC_DEVNET, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
    ];
    transaction.instructions = [...ataInstructions, ...transaction.instructions];
    return c.json({ success: true, transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"), side: parsed.data.side }, 200);
  } catch (error) {
    console.error("Prepare creator token swap error:", error);
    return c.json({ success: false, message: error instanceof Error ? error.message : "Failed to prepare swap" }, 500);
  }
}

export async function prepareMyCreatorToken(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => ({}));
  const parsedBody = creatorTokenLaunchSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json({ success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }

  try {
    const user = await getCurrentUser(c.get("privyUserId"));
    if (!user) return c.json({ success: false, message: "Create your user profile first" }, 404);
    if (user.token) return c.json({ success: true, message: "Creator token already launched", token: user.token }, 200);

    const name = getDefaultTokenName(user.displayName, user.username);
    const symbol = getDefaultSymbol(user.displayName, user.username);
    const description = parsedBody.data.description ?? (user.bio || `${user.username} creator token on Worth`);
    const launch = await prepareCreatorTokenLaunch({
      name,
      symbol,
      description,
      imageUrl: parsedBody.data.imageUrl ?? user.avatar,
      metadataUri: parsedBody.data.metadataUri,
      payer: new PublicKey(user.walletAddress),
    });

    return c.json({ success: true, launch }, 200);
  } catch (error) {
    console.error("Prepare creator token launch error:", error);
    return c.json({ success: false, message: "Failed to prepare token launch" }, 500);
  }
}

export async function confirmMyCreatorToken(c: Context<AppEnv>) {
  const parsedBody = confirmCreatorTokenSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsedBody.success) return c.json({ success: false, message: "Invalid confirmation payload" }, 400);

  try {
    const user = await getCurrentUser(c.get("privyUserId"));
    if (!user) return c.json({ success: false, message: "Create your user profile first" }, 404);
    if (user.token) return c.json({ success: true, token: user.token }, 200);

    const connection = new (await import("@solana/web3.js")).Connection(
      process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed"
    );
    const statuses = await connection.getSignatureStatuses([
      parsedBody.data.createConfigSignature,
      parsedBody.data.createPoolSignature,
    ]);
    if (statuses.value.some((status) => !status || status.err || !status.confirmationStatus)) {
      return c.json({ success: false, message: "Token launch transactions are not confirmed" }, 400);
    }

    const mint = new PublicKey(parsedBody.data.mintAddress);
    const mintAccount = await connection.getAccountInfo(mint, "confirmed");
    if (!mintAccount || mintAccount.data.length === 0) {
      return c.json({ success: false, message: "Token mint was not found on-chain" }, 400);
    }

    const [updatedUser] = await db.update(users).set({ token: mint.toBase58(), updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
    await ensurePrivateGroupForCreator(user.id);
    return c.json({ success: true, message: "Creator token confirmed", token: updatedUser?.token }, 200);
  } catch (error) {
    console.error("Confirm creator token launch error:", error);
    return c.json({ success: false, message: "Failed to confirm token launch" }, 500);
  }
}

function getDefaultSymbol(displayName: string, username: string) {
  const firstName = displayName.trim().split(/\s+/)[0] || username;
  const clean = firstName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (clean || "WORTH").slice(0, 10);
}

function getDefaultTokenName(displayName: string, username: string) {
  const firstName = displayName.trim().split(/\s+/)[0] || username;
  return `${firstName || "Creator"}'s time`;
}

async function getCurrentUser(privyUserId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.privyUserId, privyUserId))
    .limit(1);

  return user;
}

export async function getMyCreatorToken(c: Context<AppEnv>) {
  const privyUserId = c.get("privyUserId");

  try {
    const user = await getCurrentUser(privyUserId);

    if (!user) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404
      );
    }

    return c.json(
      {
        success: true,
        token: user.token || null,
      },
      200
    );
  } catch (error) {
    console.error("Get creator token error:", error);

    return c.json(
      {
        success: false,
        message: "Failed to retrieve creator token",
      },
      500
    );
  }
}

export async function launchMyCreatorToken(c: Context<AppEnv>) {
  const privyUserId = c.get("privyUserId");
  const body = await c.req.json().catch(() => ({}));
  const parsedBody = creatorTokenLaunchSchema.safeParse(body);

  if (!parsedBody.success) {
    return c.json(
      {
        success: false,
        message:
          parsedBody.error.issues[0]?.message ?? "Invalid request body",
      },
      400
    );
  }

  try {
    const user = await getCurrentUser(privyUserId);

    if (!user) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404
      );
    }

    if (user.token) {
      // Keep healthy launches idempotent, but recover records from launches
      // where the token was saved before the DBC pool was initialized.
      const connection = new Connection(
        process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
        "confirmed",
      );
      const client = new DynamicBondingCurveClient(connection, "confirmed");
      const existingPool = await resolveCreatorPool(client, user);

      if (existingPool) {
        await ensurePrivateGroupForCreator(user.id);
        return c.json(
          {
            success: true,
            message: "Creator token already launched",
            token: user.token,
            poolAddress: existingPool.address.toBase58(),
          },
          200
        );
      }

      console.warn("Replacing creator token with missing on-chain pool", {
        userId: user.id,
        previousToken: user.token,
        previousPoolAddress: user.poolAddress,
      });
    }

    const name = getDefaultTokenName(user.displayName, user.username);
    const symbol = getDefaultSymbol(user.displayName, user.username);
    const description =
      parsedBody.data.description ??
      (user.bio || `${user.username} creator token on Worth`);
    const imageUrl = parsedBody.data.imageUrl ?? user.avatar;

    const launchedToken = await launchCreatorTokenDevnet({
      name,
      symbol,
      description,
      imageUrl,
      metadataUri: parsedBody.data.metadataUri,
    });

    await db
      .update(users)
      .set({
        token: launchedToken.mintAddress,
        poolAddress: launchedToken.poolAddress,
        configAddress: launchedToken.configAddress,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // The one-step launch endpoint must create the token-gated group too.
    // The creator is inserted as the first member by the helper, so they do
    // not need to buy or hold their own token to see their group.
    await ensurePrivateGroupForCreator(user.id);

    return c.json(
      {
        success: true,
        message: "Creator token launched successfully",
        token: launchedToken.mintAddress,
        launch: launchedToken,
      },
      201
    );
  } catch (error) {
    console.error("Launch creator token error:", error);

    if (error instanceof Error) {
      if (error.message.includes("PINATA_JWT")) {
        return c.json(
          {
            success: false,
            message: "Pinata is not configured",
          },
          500
        );
      }

      if (error.message.includes("Token launch wallet is not configured")) {
        return c.json(
          {
            success: false,
            message: "Token launch wallet is not configured",
          },
          500
        );
      }
    }

    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to launch creator token",
      },
      500
    );
  }
}

export async function settleCreatorTradingFees(c: Context<AppEnv>) {
  const parsed = settleFeesSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ success: false, message: "Creator username is required" }, 400);
  }

  try {
    const [creator] = await db
      .select()
      .from(users)
      .where(eq(users.username, parsed.data.creatorUsername))
      .limit(1);

    if (!creator?.token) {
      return c.json({ success: false, message: "Creator token is not launched" }, 404);
    }

    const connection = new Connection(
      process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
      "confirmed",
    );
    const client = new DynamicBondingCurveClient(connection, "confirmed");
    const resolvedPool = await resolveCreatorPool(client, creator);
    if (!resolvedPool) {
      return c.json({ success: false, message: "Creator pool was not found on-chain" }, 404);
    }

    if (!resolvedPool.pool.poolState.isMigrated) {
      return c.json(
        {
          success: false,
          message: "Creator token has not graduated yet. Fees remain pending in Meteora.",
          graduated: false,
        },
        409,
      );
    }

    const result = await settleTradingFeesDevnet({
      poolAddress: resolvedPool.address.toBase58(),
      creatorWallet: creator.walletAddress,
    });

    return c.json({ success: true, graduated: true, ...result }, 200);
  } catch (error) {
    console.error("Settle creator trading fees error:", error);
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to settle trading fees",
      },
      500,
    );
  }
}
