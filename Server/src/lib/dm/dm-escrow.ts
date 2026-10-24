import bs58 from "bs58";
import * as anchor from "@coral-xyz/anchor";
import { randomBytes } from "node:crypto";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import worthIdl from "./worth-idl.json";

export const WORTH_PROGRAM_ID = new PublicKey(
  "FBYUHStkYfQ9i9ZwVVFB6yXN2iQUGbnQ5aFoxYbYWLCz",
);

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

function adminKeypair() {
  const secret = process.env.WORTH_ADMIN_PRIVATE_KEY?.trim();
  if (!secret) throw new Error("WORTH_ADMIN_PRIVATE_KEY is not configured");

  try {
    if (secret.startsWith("[")) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
    }
    return Keypair.fromSecretKey(bs58.decode(secret));
  } catch {
    throw new Error("WORTH_ADMIN_PRIVATE_KEY is invalid");
  }
}

function getProgram(connection: Connection, admin: Keypair) {
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(admin),
    { commitment: "confirmed" },
  );
  return new anchor.Program(worthIdl as anchor.Idl, provider) as any;
}

async function getConfig(connection: Connection, program: any) {
  const config = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId,
  )[0];
  const configState = await program.account.config.fetch(config).catch(() => null);
  if (!configState) throw new Error("Worth escrow config is not initialized");

  const admin = adminKeypair();
  if (!configState.admin.equals(admin.publicKey)) {
    throw new Error("WORTH_ADMIN_PRIVATE_KEY does not match the on-chain Worth admin");
  }

  return {
    config,
    admin,
    authorityEpoch: configState.authorityEpoch as anchor.BN,
  };
}

export function parseTokenAmount(value: string, decimals: number) {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Payment amount must be a positive decimal number");
  }
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Payment amount supports at most ${decimals} decimals`);
  }
  const units = BigInt(whole ?? "0") * 10n ** BigInt(decimals);
  const fractionUnits = BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  const result = units + fractionUnits;
  if (result <= 0n || result > 18446744073709551615n) {
    throw new Error("Payment amount is outside the supported range");
  }
  return result;
}

export function deriveDmOrderAddresses(orderIdHex: string) {
  const orderId = Buffer.from(orderIdHex, "hex");
  if (orderId.length !== 32) throw new Error("Order id must be 32 bytes");
  const [order] = PublicKey.findProgramAddressSync(
    [Buffer.from("order"), orderId],
    WORTH_PROGRAM_ID,
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), orderId],
    WORTH_PROGRAM_ID,
  );
  return { order, vault };
}

export async function prepareDmOrder({
  buyer,
  creator,
  mint,
  amount,
  expiresAt,
}: {
  buyer: PublicKey;
  creator: PublicKey;
  mint: PublicKey;
  amount: string;
  expiresAt: Date;
}) {
  const connection = new Connection(RPC_URL, "confirmed");
  const admin = adminKeypair();
  const program = getProgram(connection, admin);
  const { config, authorityEpoch } = await getConfig(connection, program);
  const mintInfo = await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID);
  const amountBaseUnits = parseTokenAmount(amount, mintInfo.decimals);
  const orderId = randomBytes(32);
  const { order, vault } = deriveDmOrderAddresses(orderId.toString("hex"));
  const source = getAssociatedTokenAddressSync(mint, buyer, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const sourceBalance = await connection.getTokenAccountBalance(source, "confirmed").catch(() => null);
  if (sourceBalance && BigInt(sourceBalance.value.amount) < amountBaseUnits) {
    throw new Error(`Insufficient payment token balance. Wallet ${buyer.toBase58()} has ${sourceBalance.value.uiAmountString} of mint ${mint.toBase58()}, but the DM requires ${amount}`);
  }
  if (!sourceBalance) {
    throw new Error(`Payment token account not found for wallet ${buyer.toBase58()} and mint ${mint.toBase58()}`);
  }

  const expiresAtUnix = BigInt(Math.floor(expiresAt.getTime() / 1000));
  return {
    orderId: orderId.toString("hex"),
    requestPda: order.toBase58(),
    escrowTokenAccount: vault.toBase58(),
    config: config.toBase58(),
    admin: admin.publicKey.toBase58(),
    authorityEpoch: authorityEpoch.toString(),
    buyer: buyer.toBase58(),
    creator: creator.toBase58(),
    source: source.toBase58(),
    amount: amountBaseUnits.toString(),
    decimals: mintInfo.decimals,
    paymentMint: mint.toBase58(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function signDmOrderTransaction({
  unsignedTransaction,
  orderId,
  buyer,
  creator,
  mint,
  amount,
  expiresAt,
}: {
  unsignedTransaction: string;
  orderId: string;
  buyer: PublicKey;
  creator: PublicKey;
  mint: PublicKey;
  amount: string;
  expiresAt: Date;
}) {
  const connection = new Connection(RPC_URL, "confirmed");
  const admin = adminKeypair();
  const program = getProgram(connection, admin);
  const { config, authorityEpoch } = await getConfig(connection, program);
  const { order, vault } = deriveDmOrderAddresses(orderId);
  const expectedAmount = BigInt(amount);
  if (expectedAmount <= 0n || expectedAmount > 18446744073709551615n) throw new Error("DM amount is outside the supported range");
  const transaction = Transaction.from(Buffer.from(unsignedTransaction, "base64"));
  if (transaction.feePayer?.toBase58() !== buyer.toBase58()) throw new Error("DM transaction fee payer does not match the buyer");
  if (new Date(expiresAt).getTime() <= Date.now()) throw new Error("DM payment request has expired");
  const requiredAddresses = [config, admin.publicKey, buyer, creator, mint, order, vault];
  const accountKeys = transaction.instructions.flatMap((instruction) => instruction.keys.map((key) => key.pubkey.toBase58()));
  if (!requiredAddresses.every((address) => accountKeys.includes(address.toBase58()))) {
    throw new Error("DM transaction accounts do not match the escrow order");
  }
  // The frontend supplies the IDL-built instruction. These values are also
  // checked here before the admin adds its signature.
  void authorityEpoch;
  void expectedAmount;
  transaction.partialSign(admin);
  return transaction.serialize({ requireAllSignatures: false }).toString("base64");
}

export async function confirmDmOrder(orderAddress: string, expected: {
  buyer: string;
  creator: string;
  mint: string;
  amount: string;
}) {
  const connection = new Connection(RPC_URL, "confirmed");
  const admin = adminKeypair();
  const program = getProgram(connection, admin);
  const state = await program.account.order.fetch(new PublicKey(orderAddress)).catch(() => null);
  if (!state || !state.status?.funded) return false;
  return state.buyer.toBase58() === expected.buyer
    && state.creator.toBase58() === expected.creator
    && state.mint.toBase58() === expected.mint
    && state.principal.toString() === expected.amount;
}

export async function prepareDmSettlement({
  orderAddress,
  participant,
  refund,
}: {
  orderAddress: string;
  participant: PublicKey;
  refund: boolean;
}) {
  const connection = new Connection(RPC_URL, "confirmed");
  const admin = adminKeypair();
  const program = getProgram(connection, admin);
  const { config, authorityEpoch } = await getConfig(connection, program);
  const order = new PublicKey(orderAddress);
  const orderState = await program.account.order.fetch(order).catch(() => null);
  if (!orderState) throw new Error("DM escrow order was not found on-chain");

  const expectedParticipant = refund ? orderState.buyer : orderState.creator;
  if (!participant.equals(expectedParticipant)) throw new Error("Settlement participant does not match the order");
  const vault = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), Buffer.from(orderState.orderId)],
    program.programId,
  )[0];
  const destination = getAssociatedTokenAddressSync(
    orderState.mint,
    participant,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const settlementTransaction = await (refund
    ? program.methods.refundOrder(authorityEpoch)
    : program.methods.releasePayment(authorityEpoch))
    .accountsStrict({
      config,
      admin: admin.publicKey,
      participant,
      order,
      mint: orderState.mint,
      vault,
      destination,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({ feePayer: participant, recentBlockhash: blockhash }).add(
    createAssociatedTokenAccountIdempotentInstruction(
      participant,
      destination,
      participant,
      orderState.mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
    ...settlementTransaction.instructions,
  );
  transaction.partialSign(admin);
  return {
    transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
    destination: destination.toBase58(),
    mint: orderState.mint.toBase58(),
    participant: participant.toBase58(),
    refund,
  };
}

export function getDmConnection() {
  return new Connection(RPC_URL, "confirmed");
}
