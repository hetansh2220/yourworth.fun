import {
  DynamicBondingCurveClient,
  buildCurveWithMarketCap,
  TokenType,
  TokenDecimal,
  TokenAuthorityOption,
  BaseFeeMode,
  CollectFeeMode,
  MigrationOption,
  MigrationFeeOption,
  ActivationType,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const connection = new Connection(
  process.env.SOLANA_RPC_URL!,
  "confirmed"
);

const client = new DynamicBondingCurveClient(
  connection,
  "confirmed"
);