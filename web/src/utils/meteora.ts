import { CONFIG_ADDRESS, USDC_MINT } from "@/constants";
import type {
  SwapInput,
  SwapQuote,
  PreparedSwap,
  SwapSide,
} from "@/hooks/market-swap-types";
import client from "@/lib/client";
import connection from "@/lib/connection";
import {
  convertToLamports,
  deriveDbcPoolAddress,
  getCurrentPoint,
  getSwapQuoteTransferFees,
  SwapMode,
  type SwapQuote2Result,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { PublicKey } from "@solana/web3.js";

const TOKEN_DECIMALS = 6;

export type MeteoraSwapContext = {
  walletAddress: string;
};

function validateInput(input: SwapInput) {
  if (!input.tokenMint.trim())
    throw new Error("Creator token mint is required");
  if (!/^\d+(\.\d+)?$/.test(input.amount.trim()) || Number(input.amount) <= 0) {
    throw new Error("Enter a valid token amount");
  }
  const slippageBps = input.slippageBps ?? 100;
  if (
    !Number.isInteger(slippageBps) ||
    slippageBps < 0 ||
    slippageBps > 10_000
  ) {
    throw new Error("Slippage must be between 0 and 10000 basis points");
  }
  return slippageBps;
}

async function getMarket(tokenMint: string) {
  const baseMint = new PublicKey(tokenMint);
  const pool = deriveDbcPoolAddress(
    new PublicKey(USDC_MINT),
    baseMint,
    new PublicKey(CONFIG_ADDRESS),
  );
  const virtualPool = await client.state.getPool(pool);
  if (!virtualPool) throw new Error("Meteora pool not found");
  const config = await client.state.getPoolConfig(virtualPool.poolState.config);
  if (!config) throw new Error("Meteora pool config not found");
  return { pool, virtualPool, config };
}

/** Checks the DBC pool's migration flag. */
export async function isMigrated(tokenMint: string): Promise<boolean> {
  const { virtualPool } = await getMarket(tokenMint);
  return Boolean(virtualPool.poolState.isMigrated);
}

async function buildQuote(side: SwapSide, input: SwapInput) {
  const slippageBps = validateInput(input);
  const { pool, virtualPool, config } = await getMarket(input.tokenMint);
  if (virtualPool.poolState.isMigrated)
    throw new Error("Market migrated; use Jupiter.");

  const baseMint = virtualPool.poolState.baseMint;
  const quoteMint = config.quoteMint;
  const swapBaseForQuote = side === "sell";
  const inputMint = swapBaseForQuote ? baseMint : quoteMint;
  const outputMint = swapBaseForQuote ? quoteMint : baseMint;
  const [currentPoint, transferFees] = await Promise.all([
    getCurrentPoint(connection, config.activationType),
    getSwapQuoteTransferFees(connection, config, { baseMint }),
  ]);
  const amountIn = convertToLamports(input.amount.trim(), TOKEN_DECIMALS);
  const result: SwapQuote2Result = client.pool.swapQuote2({
    virtualPool,
    config,
    swapBaseForQuote,
    swapMode: SwapMode.ExactIn,
    amountIn,
    slippageBps,
    hasReferral: false,
    eligibleForFirstSwapWithMinFee: false,
    currentPoint,
    ...transferFees,
  });
  if (!result.minimumAmountOut)
    throw new Error("Unable to calculate the minimum amount out");

  return {
    pool,
    amountIn,
    minimumAmountOut: result.minimumAmountOut,
    swapBaseForQuote,
    quote: {
      source: "dbc" as const,
      inputMint: inputMint.toBase58(),
      outputMint: outputMint.toBase58(),
      inputDecimals: TOKEN_DECIMALS,
      outputDecimals: TOKEN_DECIMALS,
      amountIn: result.includedTransferFeeAmountIn.toString(),
      amountOut: result.excludedTransferFeeAmountOut.toString(),
      minimumAmountOut: result.minimumAmountOut.toString(),
    } satisfies SwapQuote,
  };
}

/** Gets a DBC quote for a not-yet-migrated market. */
export async function quote(
  side: SwapSide,
  input: SwapInput,
): Promise<SwapQuote> {
  return (await buildQuote(side, input)).quote;
}

async function swap(
  side: SwapSide,
  input: SwapInput,
  context: MeteoraSwapContext,
): Promise<PreparedSwap> {
  const {
    pool,
    amountIn,
    minimumAmountOut,
    swapBaseForQuote,
    quote: swapQuote,
  } = await buildQuote(side, input);
  const owner = new PublicKey(context.walletAddress);
  const transaction = await client.pool.swap2({
    owner,
    payer: owner,
    pool,
    swapBaseForQuote,
    swapMode: SwapMode.ExactIn,
    amountIn,
    minimumAmountOut,
    referralTokenAccount: null,
  });
  transaction.feePayer = owner;
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash("confirmed")
  ).blockhash;
  const endpoint = connection.rpcEndpoint;
  const chain = /devnet/i.test(endpoint)
    ? "solana:devnet"
    : /testnet/i.test(endpoint)
      ? "solana:testnet"
      : "solana:mainnet";
  return {
    source: "dbc",
    transaction: await transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }),
    chain,
    quote: swapQuote,
  };
}

export function buy(
  input: SwapInput,
  context: MeteoraSwapContext,
): Promise<PreparedSwap> {
  return swap("buy", input, context);
}

export function sell(
  input: SwapInput,
  context: MeteoraSwapContext,
): Promise<PreparedSwap> {
  return swap("sell", input, context);
}
