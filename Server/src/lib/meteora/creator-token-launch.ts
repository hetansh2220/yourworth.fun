import {
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  DynamicBondingCurveClient,
  deriveDbcPoolAddress,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import bs58 from "bs58";
import BN from "bn.js";

import { createTokenMetadataUri } from "../pinata";
import {
  CREATOR_TRADING_FEE_PERCENTAGE,
  getCreatorTokenCurveConfig,
  getInitialPoolLiquidity,
  getMeteoraConnection,
  TRADING_FEE_BPS,
  USDC_DEVNET,
  WORTH_TRADING_FEE_PERCENTAGE,
} from "./creator-token-config";

type LaunchCreatorTokenParams = {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  metadataUri?: string;
};

export type PrepareCreatorTokenLaunchParams = LaunchCreatorTokenParams & {
  payer: PublicKey;
};

async function getLaunchWallet() {
  const privateKey = process.env.WORTH_ADMIN_PRIVATE_KEY?.trim();
  if (privateKey) {
    try {
      const secret = privateKey.startsWith("[")
        ? Uint8Array.from(JSON.parse(privateKey) as number[])
        : bs58.decode(privateKey);
      return Keypair.fromSecretKey(secret);
    } catch {
      throw new Error("WORTH_ADMIN_PRIVATE_KEY is not a valid base58 or JSON-array secret key");
    }
  }

  throw new Error("Token launch wallet is not configured. Set WORTH_ADMIN_PRIVATE_KEY");
}

let launchWalletAddressPromise: Promise<string> | null = null;

export function getLaunchWalletAddress() {
  launchWalletAddressPromise ??= getLaunchWallet().then((wallet) => wallet.publicKey.toBase58());
  return launchWalletAddressPromise;
}

export async function prepareCreatorTokenLaunch({
  name, symbol, description, imageUrl, metadataUri, payer,
}: PrepareCreatorTokenLaunchParams) {
  const connection = getMeteoraConnection();
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  const config = Keypair.generate();
  const baseMint = Keypair.generate();
  const finalMetadata = metadataUri
    ? { imageUri: imageUrl, metadataUri }
    : await createTokenMetadataUri({ name, symbol, description, imageUrl });

  const createConfigTx = await client.partner.createConfig({
    config: config.publicKey,
    feeClaimer: payer,
    leftoverReceiver: payer,
    payer,
    quoteMint: USDC_DEVNET,
    ...getCreatorTokenCurveConfig(),
  });
  createConfigTx.partialSign(config);

  const createPoolTx = await client.creator.createPoolWithFirstBuy({
    createPoolParam: {
      name, symbol, uri: finalMetadata.metadataUri, payer,
      poolCreator: payer, config: config.publicKey, baseMint: baseMint.publicKey,
    },
    firstBuyParam: {
      buyer: payer,
      buyAmount: getInitialPoolLiquidity(),
      minimumAmountOut: new BN(1),
      referralTokenAccount: null,
    },
  });
  createPoolTx.partialSign(baseMint);

  return {
    network: "devnet" as const,
    mintAddress: baseMint.publicKey.toBase58(),
    configAddress: config.publicKey.toBase58(),
    metadataUri: finalMetadata.metadataUri,
    createConfigTransaction: createConfigTx.serialize({ requireAllSignatures: false }).toString("base64"),
    createPoolTransaction: createPoolTx.serialize({ requireAllSignatures: false }).toString("base64"),
  };
}

async function waitForPool(
  client: DynamicBondingCurveClient,
  baseMint: PublicKey,
  derivedPoolAddress: PublicKey,
  retries = 10
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    // Do not decode the derived address directly while the create transaction
    // is still propagating. The SDK's getPool() fallback decoder throws an
    // Anchor discriminator error when the account is not a VirtualPool yet.
    // Looking up by the newly-created base mint is the supported, safer path.
    try {
      const pool = await client.state.getPoolByBaseMint(baseMint);

      if (pool) {
        return {
          address: pool.publicKey,
          account: pool.account,
        };
      }
    } catch (error) {
      console.warn("Meteora pool lookup by base mint failed", {
        attempt,
        baseMint: baseMint.toBase58(),
        derivedPoolAddress: derivedPoolAddress.toBase58(),
        error: error instanceof Error ? error.message : String(error),
      });
    }

    console.log("Waiting for Meteora pool", {
      attempt,
      baseMint: baseMint.toBase58(),
      derivedPoolAddress: derivedPoolAddress.toBase58(),
    });

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
  const connection = getMeteoraConnection();
  const wallet = await getLaunchWallet();
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  const curveConfig = getCreatorTokenCurveConfig();
  const config = Keypair.generate();
  const baseMint = Keypair.generate();

  console.info("Creator token launch fee configuration", {
    tradingFeeBps: TRADING_FEE_BPS,
    tradingFeePercent: TRADING_FEE_BPS / 100,
    worthFeeSharePercent: WORTH_TRADING_FEE_PERCENTAGE,
    creatorFeeSharePercent: CREATOR_TRADING_FEE_PERCENTAGE,
    feeCurrency: "USDC",
    adminWallet: wallet.publicKey.toBase58(),
    feeClaimer: wallet.publicKey.toBase58(),
    poolCreator: wallet.publicKey.toBase58(),
  });

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
    quoteMint: USDC_DEVNET,
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

  const createPoolTx = await client.creator.createPoolWithFirstBuy({
    createPoolParam: {
      name,
      symbol,
      uri: finalMetadata.metadataUri,
      payer: wallet.publicKey,
      poolCreator: wallet.publicKey,
      config: config.publicKey,
      baseMint: baseMint.publicKey,
    },
    firstBuyParam: {
      buyer: wallet.publicKey,
      buyAmount: getInitialPoolLiquidity(),
      minimumAmountOut: new BN(1),
      referralTokenAccount: null,
    },
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
    USDC_DEVNET,
    baseMint.publicKey,
    config.publicKey
  );
  const pool = await waitForPool(client, baseMint.publicKey, poolAddress);

  if (!pool) {
    throw new Error(
      `Meteora pool not found for base mint ${baseMint.publicKey.toBase58()} ` +
        `(derived address: ${poolAddress.toBase58()}, pool transaction: ${poolSignature})`
    );
  }

  return {
    network: "devnet" as const,
    name,
    symbol,
    description,
    imageUri: finalMetadata.imageUri,
    metadataUri: finalMetadata.metadataUri,
    mintAddress: baseMint.publicKey.toBase58(),
    poolAddress: pool.address.toBase58(),
    configAddress: config.publicKey.toBase58(),
    configSignature,
    poolSignature,
  };
}

/**
 * Claims both fee shares for an admin-launched pool:
 * - creator share to the creator wallet
 * - Worth partner share back to the Worth admin wallet
 */
export async function settleTradingFeesDevnet({
  poolAddress,
  creatorWallet,
}: {
  poolAddress: string;
  creatorWallet: string;
}) {
  const connection = getMeteoraConnection();
  const adminWallet = await getLaunchWallet();
  const receiver = new PublicKey(creatorWallet);
  const pool = new PublicKey(poolAddress);
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  const metrics = await client.state.getPoolFeeMetrics(pool);
  const creatorBaseFee = new BN(metrics.current.creatorBaseFee.toString());
  const creatorQuoteFee = new BN(metrics.current.creatorQuoteFee.toString());
  const worthBaseFee = new BN(metrics.current.partnerBaseFee.toString());
  const worthQuoteFee = new BN(metrics.current.partnerQuoteFee.toString());

  console.info("Trading fee balances before settlement", {
    pool: pool.toBase58(),
    creatorWallet: receiver.toBase58(),
    worthAdminWallet: adminWallet.publicKey.toBase58(),
    creatorShareQuoteToken: creatorQuoteFee.toString(),
    worthShareQuoteToken: worthQuoteFee.toString(),
    quoteToken: USDC_DEVNET.toBase58(),
    status: "pending in Meteora pool",
  });

  let creatorSignature: string | null = null;
  let worthSignature: string | null = null;

  if (creatorBaseFee.toString() !== "0" || creatorQuoteFee.toString() !== "0") {
    const creatorTransaction = await client.creator.claimCreatorTradingFeeToReceiver({
      creator: adminWallet.publicKey,
      payer: adminWallet.publicKey,
      pool,
      maxBaseAmount: creatorBaseFee,
      maxQuoteAmount: creatorQuoteFee,
      receiver,
    });

    creatorSignature = await sendAndConfirmTransaction(
      connection,
      creatorTransaction,
      [adminWallet],
      { commitment: "confirmed" },
    );
  }

  if (worthBaseFee.toString() !== "0" || worthQuoteFee.toString() !== "0") {
    const worthTransaction = await client.partner.claimPartnerTradingFeeToReceiver({
      feeClaimer: adminWallet.publicKey,
      payer: adminWallet.publicKey,
      pool,
      maxBaseAmount: worthBaseFee,
      maxQuoteAmount: worthQuoteFee,
      receiver: adminWallet.publicKey,
    });

    worthSignature = await sendAndConfirmTransaction(
      connection,
      worthTransaction,
      [adminWallet],
      { commitment: "confirmed" },
    );
  }

  console.info("Trading fee settlement completed", {
    pool: pool.toBase58(),
    creatorWallet: receiver.toBase58(),
    worthAdminWallet: adminWallet.publicKey.toBase58(),
    creatorShareSent: creatorSignature !== null,
    worthShareSent: worthSignature !== null,
    creatorSignature,
    worthSignature,
  });

  return {
    settled: creatorSignature !== null || worthSignature !== null,
    creatorWallet: receiver.toBase58(),
    worthAdminWallet: adminWallet.publicKey.toBase58(),
    creatorQuoteAmount: creatorQuoteFee.toString(),
    worthQuoteAmount: worthQuoteFee.toString(),
    creatorSignature,
    worthSignature,
  };
}
