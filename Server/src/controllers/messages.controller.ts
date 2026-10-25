import type { Context } from "hono";
import { and, asc, desc, eq, gt, lt, or } from "drizzle-orm";
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
import { getMessageRateLimitKey, isRateLimited } from "../lib/chat/rate-limit";
import { getMessageOwner } from "../lib/chat/chat-helpers";
import {
  canDeleteMessage,
  canEditMessage,
  canSendDmMessage,
} from "../lib/chat/message-permissions";
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

type MessageCursor = { createdAt: Date; id: string };

function getCursorQuery(c: Context<AppEnv>, name: "before" | "after") {
  const value = c.req.query(name);
  if (!value) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as { createdAt?: string; id?: string };
    const createdAt = decoded.createdAt ? new Date(decoded.createdAt) : null;
    const id =
      decoded.id && z.string().uuid().safeParse(decoded.id).success
        ? decoded.id
        : null;
    return createdAt && !Number.isNaN(createdAt.getTime()) && id
      ? { createdAt, id }
      : undefined;
  } catch {
    return undefined;
  }
}

function encodeCursor(message: { createdAt: Date; id: string }) {
  const cursor: MessageCursor = {
    createdAt: message.createdAt,
    id: message.id,
  };
  return Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
  ).toString("base64url");
}

function getMessageId(c: Context<AppEnv>) {
  return z.string().uuid().safeParse(c.req.param("messageId"));
}

export async function getMessages(c: Context<AppEnv>) {
  const limit = getLimit(c);
  const before = getCursorQuery(c, "before");
  const after = getCursorQuery(c, "after");

  if (before === undefined || after === undefined) {
    return c.json({ success: false, message: "Invalid message cursor" }, 400);
  }

  if (before && after) {
    return c.json(
      {
        success: false,
        message: "Use before or after, not both",
      },
      400,
    );
  }

  try {
    const where = before
      ? and(
          eq(messages.chatId, c.get("chatId")),
          or(
            lt(messages.createdAt, before.createdAt),
            and(
              eq(messages.createdAt, before.createdAt),
              lt(messages.id, before.id),
            ),
          ),
        )
      : after
        ? and(
            eq(messages.chatId, c.get("chatId")),
            or(
              gt(messages.createdAt, after.createdAt),
              and(
                eq(messages.createdAt, after.createdAt),
                gt(messages.id, after.id),
              ),
            ),
          )
        : eq(messages.chatId, c.get("chatId"));

    const rows = await db
      .select(messageFields)
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(where)
      .orderBy(
        after ? asc(messages.createdAt) : desc(messages.createdAt),
        after ? asc(messages.id) : desc(messages.id),
      )
      .limit(limit + 1);

    const hasExtra = rows.length > limit;
    const visibleMessages = rows.slice(0, limit);
    const orderedMessages = after
      ? visibleMessages
      : visibleMessages.toReversed();
    const firstMessage = orderedMessages.at(0);
    const lastMessage = orderedMessages.at(-1);

    return c.json(
      {
        success: true,
        messages: orderedMessages,
        olderCursor: firstMessage ? encodeCursor(firstMessage) : null,
        newerCursor: lastMessage ? encodeCursor(lastMessage) : null,
        hasMoreOlder: after ? false : hasExtra,
        hasMoreNewer: after ? hasExtra : false,
      },
      200,
    );
  } catch (error) {
    console.error("Get messages error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve messages",
      },
      500,
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
      400,
    );
  }

  if (
    isRateLimited(
      getMessageRateLimitKey(c.get("chatId"), c.get("currentUserId")),
      {
        limit: 20,
        windowMs: 10_000,
      },
    )
  ) {
    return c.json(
      {
        success: false,
        message: "You are sending messages too quickly",
      },
      429,
    );
  }

  if (!(await canSendDmMessage(c.get("chatId"), c.get("currentUserId")))) {
    return c.json(
      {
        success: false,
        message:
          "Paid DM messages must be sent through the creator's DM dialog",
      },
      402,
    );
  }

  try {
    const chatMessage = await createChatMessage(
      c.get("chatId"),
      c.get("currentUserId"),
      parsedBody.data.content.trim(),
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
      201,
    );
  } catch (error) {
    console.error("Send message error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to send message",
      },
      500,
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
      400,
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
      400,
    );
  }

  try {
    const message = await getMessageOwner(
      parsedMessageId.data,
      c.get("chatId"),
    );

    if (!message) {
      return c.json(
        {
          success: false,
          message: "Message not found",
        },
        404,
      );
    }

    if (!canEditMessage(message, c.get("currentUserId"))) {
      return c.json(
        {
          success: false,
          message: "You can only edit your own messages",
        },
        403,
      );
    }

    if (message.deletedAt) {
      return c.json(
        {
          success: false,
          message: "Deleted messages cannot be edited",
        },
        400,
      );
    }

    const chatMessage = await updateChatMessageContent(
      c.get("chatId"),
      parsedMessageId.data,
      parsedBody.data.content.trim(),
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
      200,
    );
  } catch (error) {
    console.error("Edit message error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to edit message",
      },
      500,
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
      400,
    );
  }

  try {
    const message = await getMessageOwner(
      parsedMessageId.data,
      c.get("chatId"),
    );

    if (!message) {
      return c.json(
        {
          success: false,
          message: "Message not found",
        },
        404,
      );
    }

    if (
      !canDeleteMessage(message, c.get("currentUserId"), c.get("chatAdminId"))
    ) {
      return c.json(
        {
          success: false,
          message: "You cannot delete this message",
        },
        403,
      );
    }

    if (message.deletedAt) {
      return c.json(
        {
          success: true,
          message: "Message already deleted",
          chatMessage: await deleteChatMessage(
            c.get("chatId"),
            parsedMessageId.data,
          ),
        },
        200,
      );
    }

    const chatMessage = await deleteChatMessage(
      c.get("chatId"),
      parsedMessageId.data,
    );

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
      200,
    );
  } catch (error) {
    console.error("Delete message error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to delete message",
      },
      500,
    );
  }
}
