export type SwapSide = "buy" | "sell";

export type SwapInput = {
  /** Creator's base token mint. */
  tokenMint: string;
  /** Human-readable amount of the input token. */
  amount: string;
  slippageBps?: number;
};

export type SwapQuote = {
  source: "dbc" | "jupiter";
  inputMint: string;
  outputMint: string;
  inputDecimals: number;
  outputDecimals: number;
  /** Amounts use each token's smallest units. */
  amountIn: string;
  amountOut: string;
  minimumAmountOut: string;
};

export type PreparedSwap =
  | {
      source: "dbc";
      transaction: Uint8Array;
      chain: "solana:devnet" | "solana:testnet" | "solana:mainnet";
      quote: SwapQuote;
    }
  | {
      source: "jupiter";
      transaction: Uint8Array;
      requestId: string;
      quote: SwapQuote;
    };

export function validateSwapInput(input: SwapInput) {
  if (!input.tokenMint.trim()) throw new Error("Creator token mint is required");
  if (!/^\d+(\.\d+)?$/.test(input.amount.trim()) || Number(input.amount) <= 0) {
    throw new Error("Enter a valid token amount");
  }
  const slippageBps = input.slippageBps ?? 100;
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 10_000) {
    throw new Error("Slippage must be between 0 and 10000 basis points");
  }
  return slippageBps;
}
