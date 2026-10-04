import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DynamicBondingCurveClient,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithMarketCap,
  deriveDbcPoolAddress,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

import { createTokenMetadataUri } from "../pinata";

const DEFAULT_DEVNET_RPC_URL = "https://api.devnet.solana.com";
const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

type LaunchCreatorTokenParams = {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  metadataUri?: string;
};

function getConnection() {
  return new Connection(
    process.env.SOLANA_RPC_URL ?? DEFAULT_DEVNET_RPC_URL,
    "confirmed"
  );
}

async function getLaunchWallet() {
  const walletPath =
    process.env.TOKEN_LAUNCH_WALLET_PATH ??
    process.env.DEVNET_WALLET_PATH ??
    "./devnet-wallet.json";

  const walletFile = Bun.file(walletPath);
  const exists = await walletFile.exists();

  if (!exists) {
    throw new Error(`Token launch wallet not found: ${walletPath}`);
  }

  const walletSecret = await walletFile.json();

  return Keypair.fromSecretKey(Uint8Array.from(walletSecret));
}

function getCurveConfig() {
  return buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.NINE,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: 1_000_000_000,
      leftover: 0,
    },

    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: 100,
          endingFeeBps: 100,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: true,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 50,
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
    initialMarketCap: 20,
    migrationMarketCap: 600,
  });
}

async function waitForPool(
  client: DynamicBondingCurveClient,
  poolAddress: PublicKey,
  retries = 10
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const pool = await client.state.getPool(poolAddress);

    if (pool) {
      return pool;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return null;
}

export async function launchCreatorTokenDevnet({
  name,
  symbol,
  description,
  imageUrl,
  metadataUri,
}: LaunchCreatorTokenParams) {
  const connection = getConnection();
  const wallet = await getLaunchWallet();
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  const curveConfig = getCurveConfig();
  const config = Keypair.generate();
  const baseMint = Keypair.generate();
  const finalMetadata = metadataUri
    ? {
        imageUri: imageUrl,
        metadataUri,
      }
    : await createTokenMetadataUri({
        name,
        symbol,
        description,
        imageUrl,
      });

  const createConfigTx = await client.partner.createConfig({
    config: config.publicKey,
    feeClaimer: wallet.publicKey,
    leftoverReceiver: wallet.publicKey,
    payer: wallet.publicKey,
    quoteMint: WSOL,
    ...curveConfig,
  });

  const configSignature = await sendAndConfirmTransaction(
    connection,
    createConfigTx,
    [wallet, config],
    {
      commitment: "confirmed",
    }
  );

  const createPoolTx = await client.creator.createPool({
    name,
    symbol,
    uri: finalMetadata.metadataUri,
    payer: wallet.publicKey,
    poolCreator: wallet.publicKey,
    config: config.publicKey,
    baseMint: baseMint.publicKey,
  });

  const poolSignature = await sendAndConfirmTransaction(
    connection,
    createPoolTx,
    [wallet, baseMint],
    {
      commitment: "confirmed",
    }
  );

  const poolAddress = deriveDbcPoolAddress(
    WSOL,
    baseMint.publicKey,
    config.publicKey
  );
  const pool = await waitForPool(client, poolAddress);

  if (!pool) {
    throw new Error(`Pool not found: ${poolAddress.toBase58()}`);
  }

  return {
    network: "devnet" as const,
    name,
    symbol,
    description,
    imageUri: finalMetadata.imageUri,
    metadataUri: finalMetadata.metadataUri,
    mintAddress: baseMint.publicKey.toBase58(),
    poolAddress: poolAddress.toBase58(),
    configAddress: config.publicKey.toBase58(),
    configSignature,
    poolSignature,
  };
}
