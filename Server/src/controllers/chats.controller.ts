import type { Context } from "hono";
import { desc, eq, getTableColumns } from "drizzle-orm";

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

/** Requires authMiddleware and chatMemberMiddleware before upgrading. */
export const chatWebSocket = upgradeWebSocket((c: Context<AppEnv>) => {
  const chatId = c.get("chatId");
  const senderId = c.get("currentUserId");
  const topic = chatTopic(chatId);

  return {
    onOpen(_event, ws) {
      (ws.raw as Bun.ServerWebSocket<BunWebSocketData>).subscribe(topic);
    },
    async onMessage(event, ws) {
      try {
        const parsed = messageSchema.safeParse(
          JSON.parse(typeof event.data === "string" ? event.data : "null"),
        );
        if (!parsed.success) {
          ws.send(
            JSON.stringify({
              channel: "error",
              message: "Message content must contain 1–2000 characters",
            }),
          );
          return;
        }

        const [message] = await db
          .insert(messages)
          .values({
            chatId,
            senderId,
            content: parsed.data.content,
          })
          .returning();

        if (!message) throw new Error("Message was not saved");

        await db
          .update(chats)
          .set({ updatedAt: message.createdAt })
          .where(eq(chats.id, chatId));
        publishMessage(chatId, message);
      } catch (error) {
        if (!(error instanceof SyntaxError))
          console.error("WebSocket message error:", error);
        ws.send(
          JSON.stringify({
            channel: "error",
            message:
              error instanceof SyntaxError
                ? "Invalid message JSON"
                : "Failed to send message",
          }),
        );
      }
    },
    onClose(_event, ws) {
      (ws.raw as Bun.ServerWebSocket<BunWebSocketData>).unsubscribe(topic);
    },
  };
});
