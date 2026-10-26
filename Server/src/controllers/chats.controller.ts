import type { Context } from "hono";
import type { WSContext } from "hono/ws";
import privy from "@/lib/privy";
import { getSolanaEmbeddedWalletAddress } from "@/middleware/authMiddleware";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";

import { db } from "@/db";
import { chatMembers, chats, messages, users } from "@/db/schema";
import type { AppEnv } from "@/types/app";
import { upgradeWebSocket, type BunWebSocketData } from "@hono/bun";
import { z } from "zod";
import { chatTopic, publishMessage } from "@/lib/websocket";

const subscribeSchema = z.object({
  type: z.literal("subscribe"),
  chatId: z.string().uuid(),
  token: z.string().min(1),
});

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

export const chatWebSocket = upgradeWebSocket((c: Context<AppEnv>) => {
  const routeChatId = c.req.param("chatId");
  let senderId: string | undefined;
  let sender: Pick<typeof users.$inferSelect, "id" | "name" | "username" | "avatar"> | undefined;
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
              sender: { id: users.id, name: users.name, username: users.username, avatar: users.avatar },
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

const createDMSchema = z.object({
  userId: z.string().uuid(),
  message: messageSchema.shape.content,
});

/** Authenticated body: { userId: recipientUserId, message }. */
export async function createDM(c: Context<AppEnv>) {
  const parsed = createDMSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid DM request",
      },
      400,
    );
  }

  try {
    const address = c.get("walletAddress");
    if (!address)
      return c.json({ success: false, message: "Unauthorized" }, 401);

    const [sender] = await db
      .select({ id: users.id, name: users.name, username: users.username, avatar: users.avatar })
      .from(users)
      .where(eq(users.address, address))
      .limit(1);

    if (!sender)
      return c.json(
        { success: false, message: "Create your user profile first" },
        404,
      );

    if (sender.id === parsed.data.userId) {
      return c.json(
        { success: false, message: "You cannot create a DM with yourself" },
        400,
      );
    }

    const [recipient] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, parsed.data.userId))
      .limit(1);
    if (!recipient)
      return c.json({ success: false, message: "User not found" }, 404);

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

    if (existingChat) {
      const [savedMessages, updatedChats] = await db.batch([
        db
          .insert(messages)
          .values({
            chatId: existingChat.id,
            senderId: sender.id,
            content: parsed.data.message,
          })
          .returning(),
        db
          .update(chats)
          .set({ updatedAt: new Date() })
          .where(eq(chats.id, existingChat.id))
          .returning(),
      ]);
      const message = savedMessages[0];
      if (!message) throw new Error("Message was not saved");
      const messageWithSender = { ...message, sender };
      publishMessage(existingChat.id, messageWithSender);
      return c.json({ success: true, chat: updatedChats[0], message: messageWithSender }, 200);
    }

    // Use the database-generated ID for both memberships in one atomic statement.
    const result = await db.execute<{
      chat: typeof chats.$inferSelect;
      message: typeof messages.$inferSelect;
    }>(sql`
      with new_chat as (
        insert into ${chats} (type, admin)
        values ('DM', ${sender.id})
        returning *
      ), new_members as (
        insert into ${chatMembers} (chat_id, user_id)
        select id, ${sender.id}::uuid from new_chat
        union all
        select id, ${recipient.id}::uuid from new_chat
      ), new_message as (
        insert into ${messages} (chat_id, sender_id, content)
        select id, ${sender.id}::uuid, ${parsed.data.message} from new_chat
        returning id, chat_id as "chatId", sender_id as "senderId", content,
          created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"
      )
      select row_to_json(chat_row) as chat, row_to_json(new_message) as message
      from (
        select id, type, admin, created_at as "createdAt", updated_at as "updatedAt"
        from new_chat
      ) chat_row cross join new_message
    `);

    const created = result.rows[0];
    if (!created) throw new Error("DM was not created");
    const messageWithSender = { ...created.message, sender };
    publishMessage(created.chat.id, messageWithSender);
    return c.json({ success: true, chat: created.chat, message: messageWithSender }, 201);
  } catch (error) {
    console.error("Create DM error:", error);
    return c.json({ success: false, message: "Failed to create DM" }, 500);
  }
}
