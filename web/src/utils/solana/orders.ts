import { BN, Program, web3, type Wallet } from "@coral-xyz/anchor";

import idl from "@/constants/idl.json";
import type { Worth } from "@/types/worth";
import { getAnchorProvider } from "@/lib/anchor";

export type CreateOrderInput = {
  admin: web3.PublicKey;
  buyer: web3.PublicKey;
  creator: web3.PublicKey;
  mint: web3.PublicKey;
  source: web3.PublicKey;
  orderId: Uint8Array;
  amountBaseUnits: BN;
  authorityEpoch: BN;
  expiresAt: BN;
};

export type SettleOrderInput = {
  admin: web3.PublicKey;
  participant: web3.PublicKey;
  mint: web3.PublicKey;
  orderId: Uint8Array;
  authorityEpoch: BN;
};

function getWorthProgram(wallet: Wallet) {
  return new Program<Worth>(idl as Worth, getAnchorProvider(wallet));
}

export function deriveOrderPda(
  programId: web3.PublicKey,
  orderId: Uint8Array,
): web3.PublicKey {
  if (orderId.length !== 32) {
    throw new Error("orderId must contain exactly 32 bytes");
  }

  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("order"), Buffer.from(orderId)],
    programId,
  )[0];
}

function deriveSettlementAccounts(
  programId: web3.PublicKey,
  input: SettleOrderInput,
) {
  const order = deriveOrderPda(programId, input.orderId);
  const tokenProgram = new web3.PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  );
  const associatedTokenProgram = new web3.PublicKey(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  );

  const [vault] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), Buffer.from(input.orderId)],
    programId,
  );
  const [destination] = web3.PublicKey.findProgramAddressSync(
    [
      input.participant.toBuffer(),
      tokenProgram.toBuffer(),
      input.mint.toBuffer(),
    ],
    associatedTokenProgram,
  );

  return { order, vault, destination, tokenProgram, associatedTokenProgram };
}

export async function createOrder(
  wallet: Wallet,
  input: CreateOrderInput,
){
  const orderId = Array.from(input.orderId);

  if (orderId.length !== 32) {
    throw new Error("orderId must contain exactly 32 bytes");
  }

  return getWorthProgram(wallet).methods
    .createOrder(
      orderId,
      input.amountBaseUnits,
      input.authorityEpoch,
      input.expiresAt,
    )
    .accountsPartial({
      admin: input.admin,
      buyer: input.buyer,
      creator: input.creator,
      mint: input.mint,
      source: input.source,
    }).instruction();
}

export async function releasePayment(
  wallet: Wallet,
  input: SettleOrderInput,
) {
  const program = getWorthProgram(wallet);
  const accounts = deriveSettlementAccounts(program.programId, input);

  return program.methods
    .releasePayment(input.authorityEpoch)
    .accountsPartial({
      admin: input.admin,
      participant: input.participant,
      ...accounts,
      mint: input.mint,
    })
    .instruction();
}

export async function refundOrder(
  wallet: Wallet,
  input: SettleOrderInput,
) {
  const program = getWorthProgram(wallet);
  const accounts = deriveSettlementAccounts(program.programId, input);

  return program.methods
    .refundOrder(input.authorityEpoch)
    .accountsPartial({
      admin: input.admin,
      participant: input.participant,
      ...accounts,
      mint: input.mint,
    })
    .instruction();
}
