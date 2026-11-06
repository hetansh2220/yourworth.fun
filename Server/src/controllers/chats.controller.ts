import {
  verifySignedTransaction,
  signAndSendTransaction,
  PaymentTransactionType,
} from "@/helpers/solana.helpers";
import { BorshInstructionCoder, type Idl } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import type BN from "bn.js";
import connection from "@/lib/connection";
import idl from "@/constants/idl.json";
import { USDC_MINT } from "@/constants";
import type { Context } from "hono";
import type { WSContext } from "hono/ws";
import privy from "@/lib/privy";
import { getSolanaEmbeddedWalletAddress } from "@/middleware/authMiddleware";
import { and, desc, eq, getTableColumns, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  chatMembers,
  chats,
  messages,
  users,
  markets,
  dmRequests,
  earnings,
} from "@/db/schema";
import type { AppEnv } from "@/types/app";
import { upgradeWebSocket, type BunWebSocketData } from "@hono/bun";
import { z } from "zod";
import { chatTopic, publishMessage } from "@/lib/websocket";

const paymentCoder = new BorshInstructionCoder(idl as Idl);

const subscribeSchema = z.object({
  type: z.literal("subscribe"),
  chatId: z.string().uuid(),
  token: z.string().min(1),
});

const messageSchema = z.object({ content: z.string().trim().min(1).max(2000) });

const createDMSchema = z.object({
  userId: z.string().uuid(),
  transaction: z.string().min(1),
  message: messageSchema.shape.content,
});

const replyDMSchema = z.object({
  message: messageSchema.shape.content,
  transaction: z.string().min(1),
});

const refundDMSchema = z.object({ transaction: z.string().min(1) });

async function withChatProfiles<T extends typeof chats.$inferSelect>(
  rows: T[],
  currentUserId: string,
) {
  const adminIds = [
    ...new Set(
      rows.filter((chat) => chat.type === "GROUP").map((chat) => chat.admin),
    ),
  ];
  const dmIds = rows
    .filter((chat) => chat.type === "DM")
    .map((chat) => chat.id);
  const [admins, members] = await Promise.all([
    adminIds.length
      ? db
          .select({ id: users.id, name: users.name, avatar: users.avatar })
          .from(users)
          .where(inArray(users.id, adminIds))
      : [],
    dmIds.length
      ? db
          .select({
            chatId: chatMembers.chatId,
            name: users.name,
            avatar: users.avatar,
          })
          .from(chatMembers)
          .innerJoin(users, eq(users.id, chatMembers.userId))
          .where(
            and(
              inArray(chatMembers.chatId, dmIds),
              ne(chatMembers.userId, currentUserId),
            ),
          )
          .orderBy(chatMembers.joinedAt, chatMembers.id)
      : [],
  ]);
  const adminById = new Map(admins.map((admin) => [admin.id, admin]));
  const memberByChat = new Map(
    members.map((member) => [member.chatId, member]),
  );
  return rows.map((chat) => {
    const profile =
      chat.type === "GROUP"
        ? adminById.get(chat.admin)
        : memberByChat.get(chat.id);
    return {
      ...chat,
      name: profile
        ? chat.type === "GROUP"
          ? `${profile.name}'s group`
          : profile.name
        : null,
      avatar: profile?.avatar ?? null,
    };
  });
}

export async function getMyChats(c: Context<AppEnv>) {
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.address, c.get("walletAddress")))
      .limit(1);

    if (!user) {
      return c.json(
        { success: false, message: "Create your user profile first" },
        404,
      );
    }

    const rows = await db
      .select({
        ...getTableColumns(chats),
        lastReadAt: chatMembers.lastReadAt,
        membersCount: db.$count(chatMembers, eq(chatMembers.chatId, chats.id)),
      })
      .from(chatMembers)
      .innerJoin(chats, eq(chatMembers.chatId, chats.id))
      .where(eq(chatMembers.userId, user.id))
      .orderBy(desc(chats.updatedAt));

    return c.json({
      success: true,
      chats: await withChatProfiles(rows, user.id),
    });
  } catch (error) {
    console.error("Get my chats error:", error);
    return c.json({ success: false, message: "Failed to retrieve chats" }, 500);
  }
}

export async function getChatById(c: Context<AppEnv>) {
  try {
    // chatMemberMiddleware verifies membership and sets chatId.
    const chatId = c.get("chatId");
    const [chat] = await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat) {
      return c.json({ success: false, message: "Chat not found" }, 404);
    }

    const [profileChat] = await withChatProfiles(
      [chat],
      c.get("currentUserId"),
    );
    return c.json({ success: true, chat: profileChat });
  } catch (error) {
    console.error("Get chat error:", error);
    return c.json({ success: false, message: "Failed to retrieve chat" }, 500);
  }
}

export async function getMembers(c: Context<AppEnv>) {
  try {
    // chatMemberMiddleware verifies membership and sets chatId.
    const members = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        avatar: users.avatar,
        joinedAt: chatMembers.joinedAt,
      })
      .from(chatMembers)
      .innerJoin(users, eq(chatMembers.userId, users.id))
      .where(eq(chatMembers.chatId, c.get("chatId")))
      .orderBy(chatMembers.joinedAt, chatMembers.id);

    return c.json({ success: true, members });
  } catch (error) {
    console.error("Get chat members error:", error);
    return c.json(
      { success: false, message: "Failed to retrieve chat members" },
      500,
    );
  }
}

export async function getMessages(c: Context<AppEnv>) {
  const limit = Number(c.req.query("limit") ?? 30);
  const offset = Number(c.req.query("offset") ?? 0);

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    return c.json(
      { success: false, message: "Use limit 1–100 and offset 0 or greater" },
      400,
    );
  }

  try {
    const rows = await db
      .select({
        ...getTableColumns(messages),
        sender: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatar: users.avatar,
        },
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.chatId, c.get("chatId")))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit)
      .offset(offset);

    return c.json({
      success: true,
      messages: rows.toReversed(),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return c.json(
      { success: false, message: "Failed to retrieve messages" },
      500,
    );
  }
}

/** Authenticated body: { userId: recipientUserId, message }. */
export async function createDM(c: Context<AppEnv>) {
  const parsed = createDMSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid DM request",
      },
      400,
    );
  let confirmedSignature: string | undefined;
  try {
    const address = c.get("walletAddress");
    if (
      !verifySignedTransaction(
        parsed.data.transaction,
        PaymentTransactionType.REQUEST,
      )
    ) {
      throw new Error("Invalid payment transaction");
    }
    const tx = Transaction.from(Buffer.from(parsed.data.transaction, "base64"));
    const instruction = tx.instructions[0]!;
    if (tx.instructions[0]?.keys[2]?.pubkey.toBase58() !== address)
      throw new Error("Transaction signer does not match your wallet");
    const args = paymentCoder.decode(instruction.data)!.data as {
      order_id: number[];
      amount_base_units: BN;
      expires_at: BN;
    };
    const details = {
      args,
      requestId: BigInt(
        `0x${Buffer.from(args.order_id).toString("hex")}`,
      ).toString(),
      requestPda: instruction.keys[6]!.pubkey.toBase58(),
      escrowTokenAccount: instruction.keys[7]!.pubkey.toBase58(),
      expiresAt: new Date(Number(args.expires_at.toString()) * 1000),
    };
    const [sender] = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        avatar: users.avatar,
      })
      .from(users)
      .where(eq(users.address, address))
      .limit(1);
    if (!sender)
      return c.json(
        { success: false, message: "Create your user profile first" },
        404,
      );
    if (sender.id === parsed.data.userId)
      return c.json(
        { success: false, message: "You cannot create a DM with yourself" },
        400,
      );
    const [recipient] = await db
      .select()
      .from(users)
      .where(eq(users.id, parsed.data.userId))
      .limit(1);
    if (!recipient)
      return c.json({ success: false, message: "User not found" }, 404);
    const [existingRequest] = await db
      .select()
      .from(dmRequests)
      .where(eq(dmRequests.requestPda, details.requestPda))
      .limit(1);
    if (existingRequest) {
      if (
        existingRequest.userId !== sender.id ||
        existingRequest.creatorId !== recipient.id
      )
        throw new Error("Order is already used");
      const [message] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, existingRequest.messageId))
        .limit(1);
      if (message?.content !== parsed.data.message)
        throw new Error("Order is already used for another message");
      return c.json({
        success: true,
        request: existingRequest,
        message: { ...message, sender },
        signature: existingRequest.createTxSignature,
      });
    }
    const [market] = await db
      .select()
      .from(markets)
      .where(
        and(eq(markets.userId, recipient.id), eq(markets.marketType, "DM")),
      )
      .limit(1);
    if (!market?.amount) throw new Error("DM market is not available");
    const mint = market.paymentType === "USDC" ? USDC_MINT : recipient.token;
    if (
      !mint ||
      instruction.keys[4]!.pubkey.toBase58() !== mint ||
      instruction.keys[3]!.pubkey.toBase58() !== recipient.address
    ) {
      throw new Error("Wrong payment mint or recipient");
    }
    const { decimals } = await getMint(
      connection,
      new PublicKey(mint),
      "confirmed",
    );
    const [whole = "0", fraction = ""] = market.amount.split(".");
    if (/[1-9]/.test(fraction.slice(decimals)))
      throw new Error("Invalid market price precision");
    const amount =
      BigInt(whole) * 10n ** BigInt(decimals) +
      BigInt(fraction.slice(0, decimals).padEnd(decimals, "0") || "0");
    if (amount <= 0n || args.amount_base_units.toString() !== amount.toString())
      throw new Error("Incorrect payment amount");
    const expiresAt = details.expiresAt.getTime();
    if (
      !Number.isFinite(expiresAt) ||
      Math.abs(expiresAt - Date.now() - 7 * 86400000) > 300000
    ) {
      throw new Error("DM expiry must be one week from now");
    }
    const [existingChat] = await db
      .select()
      .from(chats)
      .where(
        and(
          eq(chats.type, "DM"),
          sql`exists (select 1 from ${chatMembers} where ${chatMembers.chatId} = ${chats.id} and ${chatMembers.userId} = ${sender.id})`,
          sql`exists (select 1 from ${chatMembers} where ${chatMembers.chatId} = ${chats.id} and ${chatMembers.userId} = ${recipient.id})`,
        ),
      )
      .limit(1);
    confirmedSignature = await signAndSendTransaction(parsed.data.transaction);
    const confirmation = await connection.confirmTransaction(
      confirmedSignature,
      "confirmed",
    );
    if (confirmation.value.err) throw new Error("Payment transaction failed");
    // All chat/message/request writes commit together, after chain confirmation.
    const chatStatement = existingChat
      ? sql`update ${chats} set updated_at = now() where id = ${existingChat.id}::uuid returning *`
      : sql`insert into ${chats} (type, admin) values ('DM', ${sender.id}::uuid) returning *`;
    const result = await db.execute<{
      chat: typeof chats.$inferSelect;
      message: typeof messages.$inferSelect;
      request: Record<string, unknown>;
    }>(sql`
      with saved_chat as (${chatStatement}), saved_members as (
        insert into ${chatMembers} (chat_id, user_id)
        select id, ${sender.id}::uuid from saved_chat
        union all select id, ${recipient.id}::uuid from saved_chat where true
        on conflict (chat_id, user_id) do nothing
      ), saved_message as (
        insert into ${messages} (chat_id, sender_id, content)
        select id, ${sender.id}::uuid, ${parsed.data.message} from saved_chat
        returning id, chat_id as "chatId", sender_id as "senderId", content,
          created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"
      ), saved_request as (
        insert into ${dmRequests} (request_id, request_pda, escrow_token_account, chat_id, message_id, user_id, creator_id, payment_mint, amount, create_tx_signature, expires_at)
        select ${details.requestId}::numeric, ${details.requestPda}, ${details.escrowTokenAccount}, "chatId", id,
          ${sender.id}::uuid, ${recipient.id}::uuid, ${mint}, ${details.args.amount_base_units.toString()}::numeric,
          ${confirmedSignature}, ${details.expiresAt.toISOString()}::timestamptz from saved_message
        returning id
      )
      select json_build_object('id', saved_chat.id, 'type', saved_chat.type, 'admin', saved_chat.admin,
        'createdAt', saved_chat.created_at, 'updatedAt', saved_chat.updated_at) as chat,
        row_to_json(saved_message) as message, row_to_json(saved_request) as request
      from saved_chat cross join saved_message cross join saved_request
    `);
    const saved = result.rows[0];
    if (!saved) throw new Error("DM was not saved");
    const message = { ...saved.message, sender };
    publishMessage(saved.chat.id, message);
    return c.json(
      { success: true, ...saved, message, signature: confirmedSignature },
      201,
    );
  } catch (error) {
    console.error("Create DM error:", error);
    return c.json(
      {
        success: false,
        message: confirmedSignature
          ? "Transaction submitted but confirmation or database save failed. Check the returned signature before retrying."
          : "Failed to create DM. Retry the same transaction to check its status.",
        signature: confirmedSignature,
      },
      500,
    );
  }
}

export async function replyDM(c: Context<AppEnv>) {
  const parsed = replyDMSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid DM reply",
      },
      400,
    );
  if (c.get("chatType") !== "DM")
    return c.json({ success: false, message: "This chat is not a DM" }, 400);
  let confirmedSignature: string | undefined;
  try {
    const chatId = c.get("chatId");
    const address = c.get("walletAddress");
    if (
      !verifySignedTransaction(
        parsed.data.transaction,
        PaymentTransactionType.PAYOUT,
      )
    ) {
      throw new Error("Invalid payout transaction");
    }
    const tx = Transaction.from(Buffer.from(parsed.data.transaction, "base64"));
    if (tx.instructions[0]?.keys[2]?.pubkey.toBase58() !== address)
      throw new Error("Transaction signer does not match your wallet");
    const order = tx.instructions[0]!.keys[3]?.pubkey.toBase58();
    if (!order) throw new Error("Missing payment order");
    const [request] = await db
      .select()
      .from(dmRequests)
      .where(
        and(
          eq(dmRequests.requestPda, order),
          eq(dmRequests.chatId, chatId),
          eq(dmRequests.creatorId, c.get("currentUserId")),
        ),
      )
      .limit(1);
    if (!request)
      return c.json(
        {
          success: false,
          message: "DM request not found for this creator and chat",
        },
        404,
      );
    if (request.status === "COMPLETED")
      return c.json({
        success: true,
        request,
        signature: request.completeTxSignature,
      });
    if (request.status !== "PENDING")
      throw new Error("DM request is not pending");
    const [sender] = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        avatar: users.avatar,
      })
      .from(users)
      .where(eq(users.id, c.get("currentUserId")))
      .limit(1);
    if (!sender)
      return c.json({ success: false, message: "User not found" }, 404);
    const instruction = tx.instructions[0]!;
    if (
      instruction.keys[4]!.pubkey.toBase58() !== request.paymentMint ||
      instruction.keys[5]!.pubkey.toBase58() !== request.escrowTokenAccount
    ) {
      throw new Error("Payout does not match the DM request");
    }
    const { decimals } = await getMint(
      connection,
      new PublicKey(request.paymentMint),
      "confirmed",
    );
    const rawAmount = BigInt(request.amount);
    const divisor = 10n ** BigInt(decimals);
    const wholeAmount = rawAmount / divisor;
    const fractionalAmount = (rawAmount % divisor)
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");
    const earningAmount = fractionalAmount
      ? `${wholeAmount}.${fractionalAmount}`
      : wholeAmount.toString();

    confirmedSignature = await signAndSendTransaction(parsed.data.transaction);
    const confirmation = await connection.confirmTransaction(
      confirmedSignature,
      "confirmed",
    );
    if (confirmation.value.err) throw new Error("Payment transaction failed");
    const result = await db.execute<{
      message: typeof messages.$inferSelect;
    }>(sql`
      with completed as (
        update ${dmRequests} set status = 'COMPLETED', complete_tx_signature = ${confirmedSignature}, completed_at = now(), updated_at = now()
        where id = ${request.id}::uuid and status = 'PENDING' returning chat_id, creator_id
      ), saved_message as (
        insert into ${messages} (chat_id, sender_id, content)
        select chat_id, ${sender.id}::uuid, ${parsed.data.message} from completed
        returning id, chat_id as "chatId", sender_id as "senderId", content,
          created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"
      ), saved_earning as (
        insert into ${earnings} (user_id, source, amount, transaction_signature)
        select creator_id, 'DM'::earning_source, ${earningAmount}::numeric, ${confirmedSignature}
        from completed
        returning id
      ), updated_chat as (
        update ${chats} set updated_at = now() where id in (select chat_id from completed)
      ) select row_to_json(saved_message) as message from saved_message
    `);
    const saved = result.rows[0];
    if (!saved)
      return c.json({
        success: true,
        signature: confirmedSignature,
        message: "Request already completed",
      });
    const message = { ...saved.message, sender };
    publishMessage(chatId, message);
    return c.json(
      { success: true, message, signature: confirmedSignature },
      201,
    );
  } catch (error) {
    console.error("Reply DM error:", error);
    return c.json(
      {
        success: false,
        message: confirmedSignature
          ? "Transaction submitted but confirmation or database save failed. Check the returned signature before retrying."
          : "Failed to reply to DM. Retry the same transaction to check its status.",
        signature: confirmedSignature,
      },
      500,
    );
  }
}

export const chatWebSocket = upgradeWebSocket((c: Context<AppEnv>) => {
  const routeChatId = c.req.param("chatId");
  let senderId: string | undefined;
  let sender:
    | Pick<typeof users.$inferSelect, "id" | "name" | "username" | "avatar">
    | undefined;
  let topic: string | undefined;
  let authenticating = false;
  let closed = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  function reject(ws: WSContext, message: string) {
    closed = true;
    clearTimeout(timeout);
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ channel: "error", message }));
      ws.close(1008, message);
    }
  }

  return {
    onOpen(_event, ws) {
      timeout = setTimeout(() => reject(ws, "Subscription timed out"), 15_000);
    },
    async onMessage(event, ws) {
      if (closed) return;
      let payload: unknown;
      try {
        payload = JSON.parse(
          typeof event.data === "string" ? event.data : "null",
        );
      } catch {
        reject(ws, "Invalid message JSON");
        return;
      }

      if (!senderId) {
        if (authenticating) {
          reject(ws, "Subscription verification is still pending");
          return;
        }
        const parsed = subscribeSchema.safeParse(payload);
        if (!parsed.success || parsed.data.chatId !== routeChatId) {
          reject(ws, "Send a valid subscribe message for this chat");
          return;
        }
        authenticating = true;
        try {
          let address: string;
          try {
            const claims = await privy
              .utils()
              .auth()
              .verifyAccessToken(parsed.data.token);
            const user = await privy.users()._get(claims.user_id);
            address = getSolanaEmbeddedWalletAddress(user.linked_accounts);
          } catch {
            reject(ws, "Invalid or expired token");
            return;
          }
          if (!address) {
            reject(ws, "Solana embedded wallet is not ready");
            return;
          }
          const [membership] = await db
            .select({
              userId: chatMembers.userId,
              sender: {
                id: users.id,
                name: users.name,
                username: users.username,
                avatar: users.avatar,
              },
            })
            .from(chatMembers)
            .innerJoin(users, eq(chatMembers.userId, users.id))
            .where(
              and(
                eq(chatMembers.chatId, parsed.data.chatId),
                eq(users.address, address),
              ),
            )
            .limit(1);
          if (!membership) {
            reject(ws, "You are not a member of this chat");
            return;
          }
          if (closed || ws.readyState !== 1) return;

          senderId = membership.userId;
          sender = membership.sender;
          topic = chatTopic(parsed.data.chatId);
          (ws.raw as Bun.ServerWebSocket<BunWebSocketData>).subscribe(topic);
          clearTimeout(timeout);
          ws.send(
            JSON.stringify({
              channel: "subscribed",
              chatId: parsed.data.chatId,
            }),
          );

          const rows = await db
            .select({
              ...getTableColumns(messages),
              sender: {
                id: users.id,
                username: users.username,
                name: users.name,
                avatar: users.avatar,
              },
            })
            .from(messages)
            .innerJoin(users, eq(messages.senderId, users.id))
            .where(eq(messages.chatId, parsed.data.chatId))
            .orderBy(desc(messages.createdAt), desc(messages.id))
            .limit(10);
          if (!closed && ws.readyState === 1) {
            ws.send(
              JSON.stringify({ channel: "history", data: rows.toReversed() }),
            );
          }
        } catch {
          reject(ws, "Failed to subscribe to chat");
        } finally {
          authenticating = false;
        }
        return;
      }

      const parsed = messageSchema.safeParse(payload);
      if (!parsed.success) {
        ws.send(
          JSON.stringify({
            channel: "error",
            message: "Message content must contain 1–2000 characters",
          }),
        );
        return;
      }
      try {
        const [message] = await db
          .insert(messages)
          .values({
            chatId: routeChatId!,
            senderId,
            content: parsed.data.content,
          })
          .returning();
        if (!message) throw new Error("Message was not saved");
        await db
          .update(chats)
          .set({ updatedAt: message.createdAt })
          .where(eq(chats.id, routeChatId!));
        publishMessage(routeChatId!, { ...message, sender });
      } catch {
        if (!closed && ws.readyState === 1) {
          ws.send(
            JSON.stringify({
              channel: "error",
              message: "Failed to send message",
            }),
          );
        }
      }
    },
    onClose(_event, ws) {
      closed = true;
      clearTimeout(timeout);
      if (topic)
        (ws.raw as Bun.ServerWebSocket<BunWebSocketData>).unsubscribe(topic);
    },
  };
});

export async function refundDM(c: Context<AppEnv>) {
  const parsed = refundDMSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      {
        success: false,
        message: "Provide a base64 refund transaction",
      },
      400,
    );

  if (c.get("chatType") !== "DM")
    return c.json({ success: false, message: "This chat is not a DM" }, 400);

  let signature: string | undefined;
  try {
    if (
      !verifySignedTransaction(
        parsed.data.transaction,
        PaymentTransactionType.REFUND,
      )
    ) {
      throw new Error("Invalid refund transaction");
    }
    const tx = Transaction.from(Buffer.from(parsed.data.transaction, "base64"));
    const instruction = tx.instructions[0]!;
    if (instruction.keys[2]!.pubkey.toBase58() !== c.get("walletAddress")) {
      throw new Error("Transaction signer does not match your wallet");
    }
    const [request] = await db
      .select()
      .from(dmRequests)
      .where(
        and(
          eq(dmRequests.requestPda, instruction.keys[3]!.pubkey.toBase58()),
          eq(dmRequests.chatId, c.get("chatId")),
          eq(dmRequests.userId, c.get("currentUserId")),
        ),
      )
      .limit(1);
    if (!request)
      return c.json(
        {
          success: false,
          message: "DM request not found for this buyer and chat",
        },
        404,
      );
    if (request.status === "REFUNDED")
      return c.json({
        success: true,
        request,
        signature: request.refundTxSignature,
      });
    if (request.status !== "PENDING" && request.status !== "EXPIRED")
      throw new Error("DM request cannot be refunded");
    if (request.expiresAt.getTime() > Date.now())
      throw new Error("DM request has not expired yet");
    if (
      instruction.keys[4]!.pubkey.toBase58() !== request.paymentMint ||
      instruction.keys[5]!.pubkey.toBase58() !== request.escrowTokenAccount
    ) {
      throw new Error("Refund does not match the DM request");
    }

    signature = await signAndSendTransaction(parsed.data.transaction);
    const confirmation = await connection.confirmTransaction(
      signature,
      "confirmed",
    );
    if (confirmation.value.err) throw new Error("Refund transaction failed");

    const [updated] = await db
      .update(dmRequests)
      .set({
        status: "REFUNDED",
        refundTxSignature: signature,
        refundedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dmRequests.id, request.id),
          inArray(dmRequests.status, ["PENDING", "EXPIRED"]),
        ),
      )
      .returning();
    if (!updated) {
      const [current] = await db
        .select()
        .from(dmRequests)
        .where(eq(dmRequests.id, request.id))
        .limit(1);
      if (current?.status === "REFUNDED")
        return c.json({
          success: true,
          request: current,
          signature: current.refundTxSignature,
        });
      throw new Error("Refund confirmed but request status changed");
    }
    return c.json({ success: true, request: updated, signature });
  } catch (error) {
    console.error("Refund DM error:", error);
    return c.json(
      {
        success: false,
        message: signature
          ? "Transaction submitted but confirmation or database save failed. Check the returned signature before retrying."
          : "Failed to refund DM",
        signature,
      },
      500,
    );
  }
}
