import type { Context } from "hono";
import type { WSContext } from "hono/ws";
import privy from "@/lib/privy";
import { getSolanaEmbeddedWalletAddress } from "@/middleware/authMiddleware";
import { and, desc, eq, getTableColumns } from "drizzle-orm";

import { db } from "@/db";
import { chatMembers, chats, messages, users } from "@/db/schema";
import type { AppEnv } from "@/types/app";
import { upgradeWebSocket, type BunWebSocketData } from "@hono/bun";
import { z } from "zod";
import { chatTopic, publishMessage } from "@/lib/websocket";

const messageSchema = z.object({ content: z.string().trim().min(1).max(2000) });

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
      .select({ ...getTableColumns(chats), lastReadAt: chatMembers.lastReadAt })
      .from(chatMembers)
      .innerJoin(chats, eq(chatMembers.chatId, chats.id))
      .where(eq(chatMembers.userId, user.id))
      .orderBy(desc(chats.updatedAt));

    return c.json({ success: true, chats: rows });
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

    return c.json({ success: true, chat });
  } catch (error) {
    console.error("Get chat error:", error);
    return c.json({ success: false, message: "Failed to retrieve chat" }, 500);
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

const subscribeSchema = z.object({
  type: z.literal("subscribe"),
  chatId: z.string().uuid(),
  token: z.string().min(1),
});

export const chatWebSocket = upgradeWebSocket((c: Context<AppEnv>) => {
  const routeChatId = c.req.param("chatId");
  let senderId: string | undefined;
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
        payload = JSON.parse(typeof event.data === "string" ? event.data : "null");
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
            const claims = await privy.utils().auth().verifyAccessToken(parsed.data.token);
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
            .select({ userId: chatMembers.userId })
            .from(chatMembers)
            .innerJoin(users, eq(chatMembers.userId, users.id))
            .where(and(eq(chatMembers.chatId, parsed.data.chatId), eq(users.address, address)))
            .limit(1);
          if (!membership) {
            reject(ws, "You are not a member of this chat");
            return;
          }
          if (closed || ws.readyState !== 1) return;

          senderId = membership.userId;
          topic = chatTopic(parsed.data.chatId);
          (ws.raw as Bun.ServerWebSocket<BunWebSocketData>).subscribe(topic);
          clearTimeout(timeout);
          ws.send(JSON.stringify({ channel: "subscribed", chatId: parsed.data.chatId }));

          const rows = await db.select({
            ...getTableColumns(messages),
            sender: { id: users.id, username: users.username, name: users.name, avatar: users.avatar },
          }).from(messages)
            .innerJoin(users, eq(messages.senderId, users.id))
            .where(eq(messages.chatId, parsed.data.chatId))
            .orderBy(desc(messages.createdAt), desc(messages.id))
            .limit(10);
          if (!closed && ws.readyState === 1) {
            ws.send(JSON.stringify({ channel: "history", data: rows.toReversed() }));
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
        ws.send(JSON.stringify({ channel: "error", message: "Message content must contain 1–2000 characters" }));
        return;
      }
      try {
        const [message] = await db.insert(messages).values({
          chatId: routeChatId!, senderId, content: parsed.data.content,
        }).returning();
        if (!message) throw new Error("Message was not saved");
        await db.update(chats).set({ updatedAt: message.createdAt })
          .where(eq(chats.id, routeChatId!));
        publishMessage(routeChatId!, message);
      } catch {
        if (!closed && ws.readyState === 1) {
          ws.send(JSON.stringify({ channel: "error", message: "Failed to send message" }));
        }
      }
    },
    onClose(_event, ws) {
      closed = true;
      clearTimeout(timeout);
      if (topic) (ws.raw as Bun.ServerWebSocket<BunWebSocketData>).unsubscribe(topic);
    },
  };
});
