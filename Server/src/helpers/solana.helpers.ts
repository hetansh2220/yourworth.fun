import { BorshInstructionCoder, type Idl } from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { PROGRAM_ID } from "@/constants";
import idl from "@/constants/idl.json";

const programId = new PublicKey(PROGRAM_ID);
const coder = new BorshInstructionCoder(idl as Idl);
const [config] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  programId,
);

interface OrderParams {
  /** Unique 32-byte order ID, reused for settlement. */
  orderId: Uint8Array;
  mint: PublicKey;
  admin: PublicKey;
  authorityEpoch: BN;
}

export interface SendPaymentParams extends OrderParams {
  buyer: PublicKey;
  creator: PublicKey;
  /** Integer token base units, not a decimal token amount. */
  amount: BN;
  /** Unix timestamp in seconds. */
  expiresAt: BN;
}

export interface RefundPaymentParams extends OrderParams {
  buyer: PublicKey;
}

export interface CompletePaymentParams extends OrderParams {
  creator: PublicKey;
}

function orderAddresses(orderId: Uint8Array) {
  if (orderId.length !== 32)
    throw new Error("orderId must contain exactly 32 bytes");
  const seed = Buffer.from(orderId);
  const [order] = PublicKey.findProgramAddressSync(
    [Buffer.from("order"), seed],
    programId,
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), seed],
    programId,
  );
  return { order, vault };
}

function account(pubkey: PublicKey, isWritable = false, isSigner = false) {
  return { pubkey, isWritable, isSigner };
}

const programs = [
  account(TOKEN_PROGRAM_ID),
  account(ASSOCIATED_TOKEN_PROGRAM_ID),
  account(SystemProgram.programId),
];

/** Returns an unsigned escrow funding transaction. Requires buyer + admin signatures. */
export function sendPayment(params: SendPaymentParams): Transaction {
  const {
    buyer,
    creator,
    mint,
    admin,
    orderId,
    authorityEpoch,
    amount,
    expiresAt,
  } = params;
  if (amount.lten(0) || amount.bitLength() > 64)
    throw new Error("Payment amount must be positive and fit u64");
  if (authorityEpoch.isNeg() || authorityEpoch.bitLength() > 64)
    throw new Error("Authority epoch must fit u64");
  if (
    expiresAt.lten(Math.floor(Date.now() / 1000)) ||
    expiresAt.bitLength() > 63
  ) {
    throw new Error("expiresAt must be a future Unix timestamp that fits i64");
  }
  if (
    buyer.equals(creator) ||
    buyer.equals(admin) ||
    creator.equals(admin) ||
    creator.equals(PublicKey.default)
  ) {
    throw new Error(
      "Buyer, creator, and admin must be distinct valid participants",
    );
  }
  const { order, vault } = orderAddresses(orderId);
  const source = getAssociatedTokenAddressSync(mint, buyer);
  return new Transaction({ feePayer: buyer }).add(
    new TransactionInstruction({
      programId,
      keys: [
        account(config),
        account(admin, false, true),
        account(buyer, true, true),
        account(creator),
        account(mint),
        account(source, true),
        account(order, true),
        account(vault, true),
        ...programs,
      ],
      data: coder.encode("create_order", {
        order_id: Array.from(orderId),
        amount_base_units: amount,
        authority_epoch: authorityEpoch,
        expires_at: expiresAt,
      }),
    }),
  );
}

function settlement(
  params: OrderParams,
  participant: PublicKey,
  instruction: "refund_order" | "release_payment",
): Transaction {
  if (params.authorityEpoch.isNeg() || params.authorityEpoch.bitLength() > 64)
    throw new Error("Authority epoch must fit u64");
  const { order, vault } = orderAddresses(params.orderId);
  const destination = getAssociatedTokenAddressSync(params.mint, participant);
  return new Transaction({ feePayer: participant }).add(
    new TransactionInstruction({
      programId,
      keys: [
        account(config),
        account(params.admin, false, true),
        account(participant, true, true),
        account(order, true),
        account(params.mint),
        account(vault, true),
        account(destination, true),
        ...programs,
      ],
      data: coder.encode(instruction, {
        _authority_epoch: params.authorityEpoch,
      }),
    }),
  );
}

/** Returns an unsigned refund transaction. The contract requires the order to have expired. */
export function refundPayment(params: RefundPaymentParams): Transaction {
  return settlement(params, params.buyer, "refund_order");
}

/** Returns an unsigned creator payout transaction. The contract requires an unexpired order. */
export function completePayment(params: CompletePaymentParams): Transaction {
  return settlement(params, params.creator, "release_payment");
}
