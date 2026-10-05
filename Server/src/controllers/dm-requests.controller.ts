import type { Context } from "hono";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import {
  chatMembers,
  chats,
  createDmRequestSchema,
  dmRequests,
  messages,
  updateDmRequestStatusSchema,
  users,
} from "../db/schema";
import { createChatMessage } from "../lib/chat/messages";
import { publishChatEvent } from "../lib/chat/pubsub";
import type { AppEnv } from "../types/app";

const requestIdParamSchema = z.string().uuid();

async function getCurrentUser(privyUserId: string) {
  const [user] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(eq(users.privyUserId, privyUserId))
    .limit(1);

  return user;
}

async function getDmChatForMembers(chatId: string, userId: string, creatorId: string) {
  const [chat] = await db
    .select({
      id: chats.id,
      type: chats.type,
    })
    .from(chats)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.type, "DM"),
        or(
          eq(chats.admin, userId),
          eq(chats.admin, creatorId)
        )
      )
    )
    .limit(1);

  if (!chat) {
    return null;
  }

  const members = await db
    .select({
      userId: chatMembers.userId,
    })
    .from(chatMembers)
    .where(eq(chatMembers.chatId, chatId));

  const memberIds = new Set(members.map((member) => member.userId));

  return memberIds.has(userId) && memberIds.has(creatorId) ? chat : null;
}

async function getMessageInChat(messageId: string, chatId: string, senderId: string) {
  const [message] = await db
    .select({
      id: messages.id,
    })
    .from(messages)
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.chatId, chatId),
        eq(messages.senderId, senderId)
      )
    )
    .limit(1);

  return message;
}

export async function createDmRequestRecord(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => null);
  const parsedBody = createDmRequestSchema.safeParse(body);

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
    const currentUser = await getCurrentUser(c.get("privyUserId"));

    if (!currentUser) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404
      );
    }

    const chat = await getDmChatForMembers(
      parsedBody.data.chatId,
      currentUser.id,
      parsedBody.data.creatorId
    );

    if (!chat) {
      return c.json(
        {
          success: false,
          message: "DM chat not found",
        },
        404
      );
    }

    const message = parsedBody.data.messageId
      ? await getMessageInChat(
          parsedBody.data.messageId,
          parsedBody.data.chatId,
          currentUser.id
        )
      : await createChatMessage(
          parsedBody.data.chatId,
          currentUser.id,
          parsedBody.data.content?.trim() ?? ""
        );

    if (!message) {
      return c.json(
        {
          success: false,
          message: "Paid DM message not found",
        },
        404
      );
    }

    const [dmRequest] = await db
      .insert(dmRequests)
      .values({
        requestId: parsedBody.data.requestId,
        requestPda: parsedBody.data.requestPda,
        escrowTokenAccount: parsedBody.data.escrowTokenAccount,
        chatId: parsedBody.data.chatId,
        messageId: message.id,
        creatorId: parsedBody.data.creatorId,
        paymentMint: parsedBody.data.paymentMint,
        amount: parsedBody.data.amount,
        createTxSignature: parsedBody.data.createTxSignature,
        expiresAt: parsedBody.data.expiresAt,
        userId: currentUser.id,
      })
      .returning();

    publishChatEvent(parsedBody.data.chatId, {
      type: "dm_request.created",
      dmRequest,
      message,
    });

    return c.json(
      {
        success: true,
        message: "DM request recorded",
        dmRequest,
      },
      201
    );
  } catch (error) {
    console.error("Create DM request record error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to record DM request",
      },
      500
    );
  }
}

export async function getMyDmRequests(c: Context<AppEnv>) {
  try {
    const currentUser = await getCurrentUser(c.get("privyUserId"));

    if (!currentUser) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404
      );
    }

    const rows = await db
      .select()
      .from(dmRequests)
      .where(
        or(
          eq(dmRequests.userId, currentUser.id),
          eq(dmRequests.creatorId, currentUser.id)
        )
      )
      .orderBy(desc(dmRequests.createdAt));

    return c.json(
      {
        success: true,
        dmRequests: rows,
      },
      200
    );
  } catch (error) {
    console.error("Get DM requests error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve DM requests",
      },
      500
    );
  }
}

export async function updateDmRequestStatus(c: Context<AppEnv>) {
  const parsedRequestId = requestIdParamSchema.safeParse(c.req.param("id"));

  if (!parsedRequestId.success) {
    return c.json(
      {
        success: false,
        message: "DM request id is invalid",
      },
      400
    );
  }

  const body = await c.req.json().catch(() => null);
  const parsedBody = updateDmRequestStatusSchema.safeParse(body);

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
    const currentUser = await getCurrentUser(c.get("privyUserId"));

    if (!currentUser) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404
      );
    }

    const [existingRequest] = await db
      .select()
      .from(dmRequests)
      .where(eq(dmRequests.id, parsedRequestId.data))
      .limit(1);

    if (!existingRequest) {
      return c.json(
        {
          success: false,
          message: "DM request not found",
        },
        404
      );
    }

    if (existingRequest.status !== "pending") {
      return c.json(
        {
          success: false,
          message: "Only pending DM requests can be updated",
        },
        400
      );
    }

    const isCreatorAction =
      parsedBody.data.status === "completed" &&
      existingRequest.creatorId === currentUser.id;
    const isUserAction =
      (parsedBody.data.status === "refunded" ||
        parsedBody.data.status === "failed" ||
        parsedBody.data.status === "expired") &&
      existingRequest.userId === currentUser.id;

    if (!isCreatorAction && !isUserAction) {
      return c.json(
        {
          success: false,
          message: "You cannot update this DM request",
        },
        403
      );
    }

    const now = new Date();

    if (parsedBody.data.status === "completed" && now > existingRequest.expiresAt) {
      return c.json(
        {
          success: false,
          message: "Expired DM requests cannot be completed",
        },
        400
      );
    }

    if (
      (parsedBody.data.status === "refunded" || parsedBody.data.status === "expired") &&
      now < existingRequest.expiresAt
    ) {
      return c.json(
        {
          success: false,
          message: "DM request has not expired",
        },
        400
      );
    }

    const updateValues =
      parsedBody.data.status === "completed"
        ? {
            status: parsedBody.data.status,
            completeTxSignature: parsedBody.data.completeTxSignature,
            completedAt: now,
            updatedAt: now,
          }
        : parsedBody.data.status === "refunded"
          ? {
              status: parsedBody.data.status,
              refundTxSignature: parsedBody.data.refundTxSignature,
              refundedAt: now,
              updatedAt: now,
            }
          : {
              status: parsedBody.data.status,
              updatedAt: now,
            };

    const [dmRequest] = await db
      .update(dmRequests)
      .set(updateValues)
      .where(eq(dmRequests.id, existingRequest.id))
      .returning();

    if (!dmRequest) {
      throw new Error("Failed to update DM request");
    }

    publishChatEvent(existingRequest.chatId, {
      type: `dm_request.${dmRequest.status}`,
      dmRequest,
    });

    return c.json(
      {
        success: true,
        message: "DM request updated",
        dmRequest,
      },
      200
    );
  } catch (error) {
    console.error("Update DM request status error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to update DM request",
      },
      500
    );
  }
}
