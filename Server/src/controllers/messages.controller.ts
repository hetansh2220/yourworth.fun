import type { Context } from "hono";
import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { messages, users } from "../db/schema";
import {
  createChatMessage,
  deleteChatMessage,
  messageContentSchema,
  messageFields,
  updateChatMessageContent,
} from "../lib/chat/messages";
import {
  getMessageRateLimitKey,
  isRateLimited,
} from "../lib/chat/rate-limit";
import { publishChatEvent } from "../lib/chat/pubsub";
import type { AppEnv } from "../types/app";

const sendMessageSchema = z.object({
  content: messageContentSchema,
});

const updateMessageSchema = z.object({
  content: messageContentSchema,
});

function getLimit(c: Context<AppEnv>) {
  const parsedLimit = Number(c.req.query("limit") ?? "30");

  return Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 100)
    : 30;
}

function getDateQuery(c: Context<AppEnv>, name: "before" | "after") {
  const value = c.req.query(name);
  const date = value ? new Date(value) : null;

  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getMessageId(c: Context<AppEnv>) {
  return z.string().uuid().safeParse(c.req.param("messageId"));
}

async function getMessageOwner(messageId: string, chatId: string) {
  const [message] = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      deletedAt: messages.deletedAt,
    })
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.chatId, chatId)))
    .limit(1);

  return message;
}

export async function getMessages(c: Context<AppEnv>) {
  const limit = getLimit(c);
  const before = getDateQuery(c, "before");
  const after = getDateQuery(c, "after");

  if (before && after) {
    return c.json(
      {
        success: false,
        message: "Use before or after, not both",
      },
      400
    );
  }

  try {
    const where = before
      ? and(eq(messages.chatId, c.get("chatId")), lt(messages.createdAt, before))
      : after
        ? and(eq(messages.chatId, c.get("chatId")), gt(messages.createdAt, after))
        : eq(messages.chatId, c.get("chatId"));

    const rows = await db
      .select(messageFields)
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(where)
      .orderBy(after ? asc(messages.createdAt) : desc(messages.createdAt))
      .limit(limit + 1);

    const hasExtra = rows.length > limit;
    const visibleMessages = rows.slice(0, limit);
    const orderedMessages = after ? visibleMessages : visibleMessages.toReversed();
    const firstMessage = orderedMessages.at(0);
    const lastMessage = orderedMessages.at(-1);

    return c.json(
      {
        success: true,
        messages: orderedMessages,
        olderCursor: firstMessage?.createdAt.toISOString() ?? null,
        newerCursor: lastMessage?.createdAt.toISOString() ?? null,
        hasMoreOlder: after ? false : hasExtra,
        hasMoreNewer: after ? hasExtra : false,
      },
      200
    );
  } catch (error) {
    console.error("Get messages error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve messages",
      },
      500
    );
  }
}

export async function sendMessage(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => null);
  const parsedBody = sendMessageSchema.safeParse(body);

  if (!parsedBody.success) {
    return c.json(
      {
        success: false,
        message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
      },
      400
    );
  }

  if (
    isRateLimited(getMessageRateLimitKey(c.get("chatId"), c.get("currentUserId")), {
      limit: 20,
      windowMs: 10_000,
    })
  ) {
    return c.json(
      {
        success: false,
        message: "You are sending messages too quickly",
      },
      429
    );
  }

  try {
    const chatMessage = await createChatMessage(
      c.get("chatId"),
      c.get("currentUserId"),
      parsedBody.data.content.trim()
    );

    publishChatEvent(c.get("chatId"), {
      type: "message.created",
      message: chatMessage,
    });

    return c.json(
      {
        success: true,
        message: "Message sent successfully",
        chatMessage,
      },
      201
    );
  } catch (error) {
    console.error("Send message error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to send message",
      },
      500
    );
  }
}

export async function editMessage(c: Context<AppEnv>) {
  const parsedMessageId = getMessageId(c);

  if (!parsedMessageId.success) {
    return c.json(
      {
        success: false,
        message: "Message id is invalid",
      },
      400
    );
  }

  const body = await c.req.json().catch(() => null);
  const parsedBody = updateMessageSchema.safeParse(body);

  if (!parsedBody.success) {
    return c.json(
      {
        success: false,
        message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
      },
      400
    );
  }

  try {
    const message = await getMessageOwner(parsedMessageId.data, c.get("chatId"));

    if (!message) {
      return c.json(
        {
          success: false,
          message: "Message not found",
        },
        404
      );
    }

    if (message.senderId !== c.get("currentUserId")) {
      return c.json(
        {
          success: false,
          message: "You can only edit your own messages",
        },
        403
      );
    }

    if (message.deletedAt) {
      return c.json(
        {
          success: false,
          message: "Deleted messages cannot be edited",
        },
        400
      );
    }

    const chatMessage = await updateChatMessageContent(
      c.get("chatId"),
      parsedMessageId.data,
      parsedBody.data.content.trim()
    );

    publishChatEvent(c.get("chatId"), {
      type: "message.updated",
      message: chatMessage,
    });

    return c.json(
      {
        success: true,
        message: "Message updated successfully",
        chatMessage,
      },
      200
    );
  } catch (error) {
    console.error("Edit message error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to edit message",
      },
      500
    );
  }
}

export async function removeMessage(c: Context<AppEnv>) {
  const parsedMessageId = getMessageId(c);

  if (!parsedMessageId.success) {
    return c.json(
      {
        success: false,
        message: "Message id is invalid",
      },
      400
    );
  }

  try {
    const message = await getMessageOwner(parsedMessageId.data, c.get("chatId"));

    if (!message) {
      return c.json(
        {
          success: false,
          message: "Message not found",
        },
        404
      );
    }

    if (
      message.senderId !== c.get("currentUserId") &&
      c.get("chatAdminId") !== c.get("currentUserId")
    ) {
      return c.json(
        {
          success: false,
          message: "You cannot delete this message",
        },
        403
      );
    }

    if (message.deletedAt) {
      return c.json(
        {
          success: true,
          message: "Message already deleted",
          chatMessage: await deleteChatMessage(c.get("chatId"), parsedMessageId.data),
        },
        200
      );
    }

    const chatMessage = await deleteChatMessage(c.get("chatId"), parsedMessageId.data);

    publishChatEvent(c.get("chatId"), {
      type: "message.deleted",
      message: chatMessage,
    });

    return c.json(
      {
        success: true,
        message: "Message deleted successfully",
        chatMessage,
      },
      200
    );
  } catch (error) {
    console.error("Delete message error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to delete message",
      },
      500
    );
  }
}
