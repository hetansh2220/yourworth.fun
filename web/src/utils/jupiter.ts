import { CONFIG_ADDRESS, JUPITER_API, USDC_MINT } from "@/constants";
import type {
  SwapInput,
  SwapQuote,
  PreparedSwap,
  SwapSide,
} from "@/hooks/market-swap-types";
import { isMigrated } from "@/utils/meteora";
import client from "@/lib/client";
import connection from "@/lib/connection";
import {
  convertToLamports,
  deriveDbcPoolAddress,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

const TOKEN_DECIMALS = 6;

export type JupiterSwapContext = {
  walletAddress: string;
};

type JupiterOrder = {
  transaction: string | null;
  requestId: string;
  inAmount: string;
  outAmount: string;
  errorMessage?: string;
};

type JupiterExecution = {
  status: "Success" | "Failed";
  signature?: string;
  error?: string;
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

function headers(json = false): HeadersInit {
  const apiKey = process.env.NEXT_PUBLIC_JUPITER_API_KEY;
  if (!apiKey)
    throw new Error("Set NEXT_PUBLIC_JUPITER_API_KEY to enable Jupiter swaps.");
  return {
    "x-api-key": apiKey,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function getMarketMints(tokenMint: string) {
  const poolAddress = deriveDbcPoolAddress(
    new PublicKey(USDC_MINT),
    new PublicKey(tokenMint),
    new PublicKey(CONFIG_ADDRESS),
  );
  const pool = await client.state.getPool(poolAddress);
  if (!pool) throw new Error("Meteora pool not found");
  const config = await client.state.getPoolConfig(pool.poolState.config);
  if (!config) throw new Error("Meteora pool config not found");
  return { baseMint: pool.poolState.baseMint, quoteMint: config.quoteMint };
}

async function getOrder(side: SwapSide, input: SwapInput, taker?: string) {
  if (/devnet|testnet/i.test(connection.rpcEndpoint)) {
    throw new Error(
      "Jupiter swaps are only available on mainnet. This app is currently connected to devnet.",
    );
  }
  const slippageBps = validateInput(input);
  if (!(await isMigrated(input.tokenMint))) {
    throw new Error(
      "Market is still on Meteora DBC; Jupiter is not available yet.",
    );
  }
  const { baseMint, quoteMint } = await getMarketMints(input.tokenMint);
  const sellingBase = side === "sell";
  const inputMint = sellingBase ? baseMint : quoteMint;
  const outputMint = sellingBase ? quoteMint : baseMint;
  const inputDecimals = TOKEN_DECIMALS;
  const outputDecimals = TOKEN_DECIMALS;
  const amount = convertToLamports(
    input.amount.trim(),
    TOKEN_DECIMALS,
  ).toString();
  const params = new URLSearchParams({
    inputMint: inputMint.toBase58(),
    outputMint: outputMint.toBase58(),
    amount,
    slippageBps: String(slippageBps),
    ...(taker ? { taker } : {}),
  });
  const response = await fetch(`${JUPITER_API}/order?${params}`, {
    headers: headers(),
  });
  if (!response.ok)
    throw new Error(`Jupiter quote failed (${response.status})`);
  const order = (await response.json()) as JupiterOrder;
  if (!order.outAmount)
    throw new Error(order.errorMessage || "Jupiter returned no quote");
  const minimumAmountOut = (
    (BigInt(order.outAmount) * BigInt(10_000 - slippageBps)) /
    BigInt(10_000)
  ).toString();
  return {
    order,
    quote: {
      source: "jupiter" as const,
      inputMint: inputMint.toBase58(),
      outputMint: outputMint.toBase58(),
      inputDecimals,
      outputDecimals,
      amountIn: order.inAmount || amount,
      amountOut: order.outAmount,
      minimumAmountOut,
    } satisfies SwapQuote,
  };
}

/** Gets a quote for a migrated market. */
export async function quote(
  side: SwapSide,
  input: SwapInput,
): Promise<SwapQuote> {
  return (await getOrder(side, input)).quote;
}

async function swap(
  side: SwapSide,
  input: SwapInput,
  context: JupiterSwapContext,
): Promise<PreparedSwap> {
  const { order, quote: swapQuote } = await getOrder(
    side,
    input,
    context.walletAddress,
  );
  if (!order.transaction)
    throw new Error(
      order.errorMessage || "Jupiter could not build a swap transaction",
    );
  return {
    source: "jupiter",
    transaction: Uint8Array.from(Buffer.from(order.transaction, "base64")),
    requestId: order.requestId,
    quote: swapQuote,
  };
}

export function buy(
  input: SwapInput,
  context: JupiterSwapContext,
): Promise<PreparedSwap> {
  return swap("buy", input, context);
}

export function sell(
  input: SwapInput,
  context: JupiterSwapContext,
): Promise<PreparedSwap> {
  return swap("sell", input, context);
}

/** Submits a Privy-signed Jupiter transaction to Jupiter's execution endpoint. */
export async function execute(
  signedTransaction: Uint8Array,
  requestId: string,
): Promise<string> {
  const response = await fetch(`${JUPITER_API}/execute`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({
      signedTransaction: Buffer.from(signedTransaction).toString("base64"),
      requestId,
    }),
  });
  if (!response.ok)
    throw new Error(`Jupiter execution failed (${response.status})`);
  const execution = (await response.json()) as JupiterExecution;
  if (execution.status !== "Success" || !execution.signature) {
    throw new Error(execution.error || "Jupiter could not complete the swap");
  }
  return execution.signature;
}
