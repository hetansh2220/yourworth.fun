import { Connection, PublicKey } from "@solana/web3.js";
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithMarketCap,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import BN from "bn.js";

const DEFAULT_DEVNET_RPC_URL = "https://api.devnet.solana.com";

export const TRADING_FEE_BPS = 100;
export const WORTH_TRADING_FEE_PERCENTAGE = 50;
export const CREATOR_TRADING_FEE_PERCENTAGE = 100 - WORTH_TRADING_FEE_PERCENTAGE;

export const USDC_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

export function getMeteoraConnection() {
  return new Connection(
    process.env.SOLANA_RPC_URL ?? DEFAULT_DEVNET_RPC_URL,
    "confirmed",
  );
}

export function getInitialPoolLiquidity() {
  const amount = process.env.INITIAL_POOL_LIQUIDITY_USDC ?? "1";
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("INITIAL_POOL_LIQUIDITY_USDC must be a positive number");
  }
  return new BN(Math.round(parsed * 1_000_000));
}

export function getCreatorTokenCurveConfig() {
  return buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.NINE,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: 100_000,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: TRADING_FEE_BPS,
          endingFeeBps: TRADING_FEE_BPS,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: true,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: CREATOR_TRADING_FEE_PERCENTAGE,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps200,
      migrationFee: {
        feePercentage: 0,
        creatorFeePercentage: 0,
      },
    },
    liquidityDistribution: {
      partnerLiquidityPercentage: 50,
      partnerPermanentLockedLiquidityPercentage: 5,
      creatorLiquidityPercentage: 40,
      creatorPermanentLockedLiquidityPercentage: 5,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    initialMarketCap: 1,
    migrationMarketCap: 5,
  });
}
