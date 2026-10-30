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
  authorityEpoch: BN;
};

function getWorthProgram(wallet: Wallet) {
  return new Program<Worth>(idl as Worth, getAnchorProvider(wallet));
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
    .accounts({
      admin: input.admin,
      buyer: input.buyer,
      creator: input.creator,
      mint: input.mint,
      source: input.source,
    }).instruction();
}

export async function releassePayment(
  wallet: Wallet,
  input: SettleOrderInput,
): Promise<string> {
  return getWorthProgram(wallet).methods
    .releasePayment(input.authorityEpoch)
    .accounts({
      admin: input.admin,
      participant: input.participant,
    })
    .rpc();
}

export async function refundOrder(
  wallet: Wallet,
  input: SettleOrderInput,
): Promise<string> {
  return getWorthProgram(wallet).methods
    .refundOrder(input.authorityEpoch)
    .accounts({
      admin: input.admin,
      participant: input.participant,
    })
    .rpc();
}
