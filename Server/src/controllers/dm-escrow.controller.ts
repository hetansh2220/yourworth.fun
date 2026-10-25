import type { Context } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { PublicKey, SendTransactionError, Transaction } from "@solana/web3.js";

import { db } from "../db";
import { chatMembers, chats, dmRequests, markets, users } from "../db/schema";
import { createChatMessage } from "../lib/chat/messages";
import { publishChatEvent } from "../lib/chat/pubsub";
import {
  confirmDmOrder,
  deriveDmOrderAddresses,
  getDmConnection,
  prepareDmOrder,
  signDmOrderTransaction,
} from "../lib/dm/dm-escrow";
import type { AppEnv } from "../types/app";

const prepareSchema = z.object({
  chatId: z.string().uuid(),
  creatorId: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
});

const submitSchema = z
  .object({
    signedTransaction: z.string().min(20).optional(),
    signature: z.string().min(32).optional(),
    chatId: z.string().uuid(),
    creatorId: z.string().uuid(),
    content: z.string().trim().min(1).max(2000),
    orderId: z.string().regex(/^[0-9a-f]{64}$/i),
    requestPda: z.string().min(32).max(44),
    escrowTokenAccount: z.string().min(32).max(44),
    paymentMint: z.string().min(32).max(44),
    amount: z.string().regex(/^\d+$/),
    expiresAt: z.coerce.date(),
  })
  .refine(
    (value) => Boolean(value.signedTransaction) !== Boolean(value.signature),
    "Provide either signedTransaction or signature",
  );
const adminSignSchema = z.object({
  unsignedTransaction: z.string().min(20),
  chatId: z.string().uuid(),
  creatorId: z.string().uuid(),
  orderId: z.string().regex(/^[0-9a-f]{64}$/i),
  requestPda: z.string().min(32).max(44),
  paymentMint: z.string().min(32).max(44),
  amount: z.string().regex(/^\d+$/),
  expiresAt: z.coerce.date(),
});

async function currentUser(walletAddress: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.address, walletAddress))
    .limit(1);
  return user;
}

async function getDmContext(
  chatId: string,
  buyerId: string,
  creatorId: string,
) {
  const [chat] = await db
    .select({ id: chats.id, type: chats.type })
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.type, "DM")))
    .limit(1);
  if (!chat) return null;

  const members = await db
    .select({ userId: chatMembers.userId })
    .from(chatMembers)
    .where(eq(chatMembers.chatId, chatId));
  const memberIds = new Set(members.map((member) => member.userId));
  return memberIds.has(buyerId) && memberIds.has(creatorId) ? chat : null;
}

async function getDmMarket(creatorId: string) {
  const [market] = await db
    .select()
    .from(markets)
    .where(and(eq(markets.userId, creatorId), eq(markets.marketType, "DM")))
    .limit(1);
  return market;
}

export async function prepareDmPayment(c: Context<AppEnv>) {
  const parsed = prepareSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid DM payment",
      },
      400,
    );

  try {
    const buyer = await currentUser(c.get("walletAddress"));
    if (!buyer)
      return c.json(
        { success: false, message: "Create your user profile first" },
        404,
      );
    const creator = await db
      .select()
      .from(users)
      .where(eq(users.id, parsed.data.creatorId))
      .limit(1)
      .then((rows) => rows[0]);
    if (!creator)
      return c.json({ success: false, message: "Creator not found" }, 404);
    if (creator.id === buyer.id)
      return c.json(
        { success: false, message: "You cannot pay yourself" },
        400,
      );
    if (!(await getDmContext(parsed.data.chatId, buyer.id, creator.id)))
      return c.json({ success: false, message: "DM chat not found" }, 404);

    const market = await getDmMarket(creator.id);
    if (!market || !market.amount || Number(market.amount) <= 0) {
      return c.json(
        { success: false, message: "Creator DM pricing is not configured" },
        400,
      );
    }
    if (market.paymentType !== "CREATOR_TOKEN")
      return c.json(
        { success: false, message: "USDC DM escrow is not supported yet" },
        400,
      );
    // Paid DMs use the creator token. Keep this server-side rule independent
    // of stale market rows that were created before DM pricing became token-only.
    const paymentMint = creator.token;
    if (!paymentMint)
      return c.json(
        { success: false, message: "Creator token is not launched" },
        400,
      );
    if (c.get("walletAddress") !== buyer.address) {
      return c.json(
        {
          success: false,
          message: "Active wallet does not match your profile wallet",
        },
        409,
      );
    }
    const buyerBalance = await getDmConnection().getBalance(
      new PublicKey(c.get("walletAddress")),
      "confirmed",
    );
    if (buyerBalance < 5_000_000) {
      return c.json(
        {
          success: false,
          message: `Your active Privy wallet needs at least 0.005 SOL for DM escrow account rent and fees. Wallet: ${c.get("walletAddress")}`,
          walletAddress: c.get("walletAddress"),
          balanceSol: buyerBalance / 1_000_000_000,
        },
        400,
      );
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const prepared = await prepareDmOrder({
      buyer: new PublicKey(c.get("walletAddress")),
      creator: new PublicKey(creator.address),
      mint: new PublicKey(paymentMint),
      amount: market.amount,
      expiresAt,
    });

    return c.json(
      {
        success: true,
        marketType: "DM",
        paymentType: "CREATOR_TOKEN",
        content: parsed.data.content,
        creatorId: creator.id,
        ...prepared,
      },
      200,
    );
  } catch (error) {
    console.error("Prepare DM payment error:", error);
    return c.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to prepare DM payment",
      },
      500,
    );
  }
}

export async function adminSignDmPayment(c: Context<AppEnv>) {
  const parsed = adminSignSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success)
    return c.json(
      { success: false, message: "Invalid DM escrow transaction" },
      400,
    );
  try {
    const buyer = await currentUser(c.get("walletAddress"));
    const creator = await db
      .select()
      .from(users)
      .where(eq(users.id, parsed.data.creatorId))
      .limit(1)
      .then((rows) => rows[0]);
    if (
      !buyer ||
      !creator ||
      !(await getDmContext(parsed.data.chatId, buyer.id, creator.id))
    )
      return c.json({ success: false, message: "DM chat not found" }, 404);
    if (c.get("walletAddress") !== buyer.address)
      return c.json(
        {
          success: false,
          message: "Active wallet does not match the buyer wallet",
        },
        409,
      );
    if (parsed.data.paymentMint !== creator.token)
      return c.json(
        {
          success: false,
          message: "Payment mint does not match the creator token",
        },
        400,
      );
    if (
      deriveDmOrderAddresses(parsed.data.orderId).order.toBase58() !==
      parsed.data.requestPda
    )
      return c.json(
        { success: false, message: "Order PDA does not match the order id" },
        400,
      );
    const signedTransaction = await signDmOrderTransaction({
      unsignedTransaction: parsed.data.unsignedTransaction,
      orderId: parsed.data.orderId,
      buyer: new PublicKey(buyer.address),
      creator: new PublicKey(creator.address),
      mint: new PublicKey(parsed.data.paymentMint),
      amount: parsed.data.amount,
      expiresAt: parsed.data.expiresAt,
    });
    return c.json({ success: true, signedTransaction }, 200);
  } catch (error) {
    console.error("Admin-sign DM payment error:", error);
    return c.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to sign DM payment",
      },
      500,
    );
  }
}

export async function submitDmPayment(c: Context<AppEnv>) {
  const parsed = submitSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid DM payment",
      },
      400,
    );

  try {
    const buyer = await currentUser(c.get("walletAddress"));
    if (!buyer)
      return c.json(
        { success: false, message: "Create your user profile first" },
        404,
      );
    const creator = await db
      .select()
      .from(users)
      .where(eq(users.id, parsed.data.creatorId))
      .limit(1)
      .then((rows) => rows[0]);
    if (
      !creator ||
      !(await getDmContext(parsed.data.chatId, buyer.id, creator.id))
    )
      return c.json({ success: false, message: "DM chat not found" }, 404);
    if (c.get("walletAddress") !== buyer.address)
      return c.json(
        {
          success: false,
          message: "Active wallet does not match your profile wallet",
        },
        409,
      );

    const connection = getDmConnection();
    let signature = parsed.data.signature ?? "";
    if (parsed.data.signedTransaction) {
      const raw = Buffer.from(parsed.data.signedTransaction, "base64");
      const transaction = Transaction.from(raw);
      if (transaction.feePayer?.toBase58() !== c.get("walletAddress"))
        return c.json(
          {
            success: false,
            message: "Transaction fee payer does not match the buyer wallet",
          },
          400,
        );
      if (transaction.signatures.some((item) => !item.signature))
        return c.json(
          { success: false, message: "Transaction is not fully signed" },
          400,
        );
      const buyerBalance = await connection.getBalance(
        new PublicKey(c.get("walletAddress")),
        "confirmed",
      );
      if (buyerBalance < 5_000_000)
        return c.json(
          {
            success: false,
            message:
              "The active Privy wallet has insufficient SOL for DM escrow rent and fees",
          },
          400,
        );
      signature = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 3,
      });
      await connection.confirmTransaction(signature, "confirmed");
    } else {
      const status = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });
      if (!status.value || status.value.err)
        return c.json(
          {
            success: false,
            message: "The escrow transaction was not confirmed on Solana",
          },
          400,
        );
      const confirmedTransaction = await connection.getParsedTransaction(
        signature,
        { commitment: "confirmed", maxSupportedTransactionVersion: 0 },
      );
      const feePayer =
        confirmedTransaction?.transaction.message.accountKeys[0]?.pubkey.toBase58();
      if (feePayer !== c.get("walletAddress"))
        return c.json(
          {
            success: false,
            message:
              "The escrow transaction fee payer does not match the buyer wallet",
          },
          400,
        );
    }
    const validOrder = await confirmDmOrder(parsed.data.requestPda, {
      buyer: buyer.address,
      creator: creator.address,
      mint: parsed.data.paymentMint,
      amount: parsed.data.amount,
    });
    if (!validOrder)
      return c.json(
        { success: false, message: "On-chain DM order could not be verified" },
        400,
      );

    const message = await createChatMessage(
      parsed.data.chatId,
      buyer.id,
      parsed.data.content,
    );
    if (!message) throw new Error("Failed to create the paid DM message");
    const requestId = Number.parseInt(parsed.data.orderId.slice(0, 12), 16);
    const [dmRequest] = await db
      .insert(dmRequests)
      .values({
        requestId,
        requestPda: parsed.data.requestPda,
        escrowTokenAccount: parsed.data.escrowTokenAccount,
        chatId: parsed.data.chatId,
        messageId: message.id,
        creatorId: creator.id,
        paymentMint: parsed.data.paymentMint,
        amount: parsed.data.amount,
        createTxSignature: signature,
        expiresAt: parsed.data.expiresAt,
        userId: buyer.id,
      })
      .returning();

    publishChatEvent(parsed.data.chatId, {
      type: "dm_request.created",
      dmRequest,
      message,
    });
    return c.json({ success: true, signature, dmRequest, message }, 201);
  } catch (error) {
    console.error("Submit DM payment error:", error);
    if (error instanceof SendTransactionError) {
      const logs = await error
        .getLogs(getDmConnection())
        .catch(() => undefined);
      console.error("DM escrow simulation logs:", logs);
      return c.json(
        {
          success: false,
          message: error.message,
          ...(logs ? { logs } : {}),
        },
        500,
      );
    }
    return c.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to submit DM payment",
      },
      500,
    );
  }
}
