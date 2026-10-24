import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { PublicKey, Transaction } from "@solana/web3.js";

import { db } from "../db";
import { dmRequests, users } from "../db/schema";
import { createChatMessage } from "../lib/chat/messages";
import { publishChatEvent } from "../lib/chat/pubsub";
import { getDmConnection, prepareDmSettlement } from "../lib/dm/dm-escrow";
import type { AppEnv } from "../types/app";

const requestIdSchema = z.string().uuid();
const prepareSchema = z.object({ refund: z.boolean().default(false) });
const submitSchema = z.object({
  refund: z.boolean().default(false),
  signedTransaction: z.string().min(20).optional(),
  signature: z.string().min(32).optional(),
  content: z.string().trim().min(1).max(2000).optional(),
}).refine((value) => Boolean(value.signedTransaction) !== Boolean(value.signature), "Provide either signedTransaction or signature");

async function requestFor(id: string) {
  const [request] = await db.select().from(dmRequests).where(eq(dmRequests.id, id)).limit(1);
  return request;
}

async function userFor(privyUserId: string) {
  const [user] = await db.select().from(users).where(eq(users.privyUserId, privyUserId)).limit(1);
  return user;
}

export async function prepareDmSettlementTransaction(c: Context<AppEnv>) {
  const parsedId = requestIdSchema.safeParse(c.req.param("id"));
  const parsedBody = prepareSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsedId.success || !parsedBody.success) return c.json({ success: false, message: "Invalid settlement request" }, 400);
  try {
    const user = await userFor(c.get("privyUserId"));
    const request = await requestFor(parsedId.data);
    if (!user || !request) return c.json({ success: false, message: "DM request not found" }, 404);
    if (request.status !== "pending") return c.json({ success: false, message: "DM request is already settled" }, 400);
    const isCreator = request.creatorId === user.id;
    const isBuyer = request.userId === user.id;
    if (parsedBody.data.refund ? !isBuyer : !isCreator) return c.json({ success: false, message: "You cannot settle this DM request" }, 403);
    if (c.get("walletAddress") !== user.walletAddress) return c.json({ success: false, message: "Active wallet does not match your profile wallet" }, 409);
    if (parsedBody.data.refund && new Date() < request.expiresAt) return c.json({ success: false, message: "Refund is available after the request expires" }, 400);
    const prepared = await prepareDmSettlement({
      orderAddress: request.requestPda,
      participant: new PublicKey(user.walletAddress),
      refund: parsedBody.data.refund,
    });
    return c.json({ success: true, requestId: request.id, ...prepared }, 200);
  } catch (error) {
    console.error("Prepare DM settlement error:", error);
    return c.json({ success: false, message: error instanceof Error ? error.message : "Failed to prepare settlement" }, 500);
  }
}

export async function submitDmSettlementTransaction(c: Context<AppEnv>) {
  const parsedId = requestIdSchema.safeParse(c.req.param("id"));
  const parsedBody = submitSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsedId.success || !parsedBody.success) return c.json({ success: false, message: "Invalid settlement transaction" }, 400);
  try {
    const user = await userFor(c.get("privyUserId"));
    const request = await requestFor(parsedId.data);
    if (!user || !request) return c.json({ success: false, message: "DM request not found" }, 404);
    if (request.status !== "pending") return c.json({ success: false, message: "DM request is already settled" }, 400);
    if (parsedBody.data.refund ? request.userId !== user.id : request.creatorId !== user.id) return c.json({ success: false, message: "You cannot settle this DM request" }, 403);
    if (!parsedBody.data.refund && !parsedBody.data.content) return c.json({ success: false, message: "A creator response is required to release the payment" }, 400);
    if (c.get("walletAddress") !== user.walletAddress) return c.json({ success: false, message: "Active wallet does not match your profile wallet" }, 409);
    const connection = getDmConnection();
    let signature = parsedBody.data.signature ?? "";
    if (parsedBody.data.signedTransaction) {
      const raw = Buffer.from(parsedBody.data.signedTransaction, "base64");
      const transaction = Transaction.from(raw);
      if (transaction.feePayer?.toBase58() !== user.walletAddress || transaction.signatures.some((item) => !item.signature)) return c.json({ success: false, message: "Transaction is not signed by the settlement wallet" }, 400);
      signature = await connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction(signature, "confirmed");
    } else {
      const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
      if (!status.value || status.value.err) return c.json({ success: false, message: "The settlement transaction was not confirmed on Solana" }, 400);
      const confirmedTransaction = await connection.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      const feePayer = confirmedTransaction?.transaction.message.accountKeys[0]?.pubkey.toBase58();
      if (feePayer !== user.walletAddress) return c.json({ success: false, message: "The settlement fee payer does not match the participant wallet" }, 400);
    }
    const now = new Date();
    const [updated] = await db.update(dmRequests).set(parsedBody.data.refund ? {
      status: "refunded", refundTxSignature: signature, refundedAt: now, updatedAt: now,
    } : {
      status: "completed", completeTxSignature: signature, completedAt: now, updatedAt: now,
    }).where(eq(dmRequests.id, request.id)).returning();
    let message;
    if (!parsedBody.data.refund && parsedBody.data.content) {
      message = await createChatMessage(request.chatId, user.id, parsedBody.data.content);
      publishChatEvent(request.chatId, { type: "dm_request.completed", dmRequest: updated, message });
    } else {
      publishChatEvent(request.chatId, { type: "dm_request.refunded", dmRequest: updated });
    }
    return c.json({ success: true, signature, dmRequest: updated, ...(message ? { message } : {}) }, 200);
  } catch (error) {
    console.error("Submit DM settlement error:", error);
    return c.json({ success: false, message: error instanceof Error ? error.message : "Failed to submit settlement" }, 500);
  }
}
