import { Keypair, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import connection from "@/lib/connection";
import signer from "@/lib/signer";
import dbc from "@/lib/dbc";
import {
  ActivationType,
  BaseFeeMode,
  buildCurve,
  CollectFeeMode,
  DammV2BaseFeeMode,
  DammV2DynamicFeeMode,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  type BuildCurveParams,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { USDC_MINT } from "@/constants";

// Mainnet USDC. Use a funded test quote mint when testing on devnet.
const QUOTE_MINT = new PublicKey(USDC_MINT);

const curveParams: BuildCurveParams = {
  token: {
    tokenType: TokenType.SPLToken,
    tokenBaseDecimal: TokenDecimal.SIX,
    tokenQuoteDecimal: TokenDecimal.SIX,
    tokenAuthorityOption: TokenAuthorityOption.Immutable,
    totalTokenSupply: 100_000,
    leftover: 0,
  },
  percentageSupplyOnMigration: 20,
  migrationQuoteThreshold: 750,
  fee: {
    baseFeeParams: {
      baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
      feeSchedulerParam: {
        startingFeeBps: 200,
        endingFeeBps: 200,
        numberOfPeriod: 0,
        totalDuration: 0,
      },
    },
    dynamicFeeEnabled: true,
    collectFeeMode: CollectFeeMode.QuoteToken,
    // All distributable pre-migration fees go to the platform partner.
    // Any actual creator revenue share is paid separately by your app.
    creatorTradingFeePercentage: 50,
    poolCreationFee: 0,
    enableFirstSwapWithMinFee: false,
  },
  migration: {
    migrationOption: MigrationOption.MET_DAMM_V2,
    migrationFeeOption: MigrationFeeOption.Customizable,
    migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
    migratedPoolFee: {
      collectFeeMode: MigratedCollectFeeMode.QuoteToken,
      dynamicFee: DammV2DynamicFeeMode.Disabled,
      poolFeeBps: 200,
      baseFeeMode: DammV2BaseFeeMode.FeeTimeSchedulerLinear,
    },
  },
  liquidityDistribution: {
    partnerLiquidityPercentage: 0,
    creatorLiquidityPercentage: 0,
    partnerPermanentLockedLiquidityPercentage: 50,
    creatorPermanentLockedLiquidityPercentage: 50,
  },
  lockedVesting: {
    totalLockedVestingAmount: 0,
    numberOfVestingPeriod: 0,
    cliffUnlockAmount: 0,
    totalVestingDuration: 0,
    cliffDurationFromMigrationTime: 0,
  },
  activationType: ActivationType.Timestamp,
};

const curveConfig = buildCurve(curveParams);

/** Creates and confirms a config using the platform signer and a new config keypair. */
async function createConfig() {
  const config = Keypair.generate();

  const tx = await dbc.partner.createConfig({
    ...curveConfig,
    config: config.publicKey,
    feeClaimer: signer.publicKey,
    leftoverReceiver: signer.publicKey,
    payer: signer.publicKey,
    quoteMint: QUOTE_MINT,
  });

  tx.feePayer = signer.publicKey;

  const signature = await sendAndConfirmTransaction(
    connection,
    tx,
    [signer, config],
    { commitment: "confirmed" },
  );

  console.log(config.publicKey.toBase58(), signature);
}

createConfig().catch((err) => {
  console.error(err);
  process.exit(1);
});
