import type { Context, Next } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { chatMembers } from "../db/schema";
import { getChatAccess, getCurrentUser, hasChatAccess } from "../lib/chat/chat-helpers";
import type { AppEnv } from "../types/app";

export async function chatMemberMiddleware(c: Context<AppEnv>, next: Next) {
  const parsedChatId = z.string().uuid().safeParse(c.req.param("chatId"));

  if (!parsedChatId.success) {
    return c.json(
      {
        success: false,
        message: "Chat id is invalid",
      },
      400
    );
  }

  try {
    const user = await getCurrentUser(c.get("privyUserId"));

    if (!user) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404
      );
    }

    const membership = await hasChatAccess(parsedChatId.data, user.id, user.walletAddress);

    if (!membership) {
      const existingMembership = await getChatAccess(parsedChatId.data, user.id);
      if (existingMembership?.chatType === "GROUP" && existingMembership.creatorId && existingMembership.creatorId !== user.id) {
        await db.delete(chatMembers).where(and(eq(chatMembers.chatId, parsedChatId.data), eq(chatMembers.userId, user.id)));
        return c.json(
          {
            success: false,
            message: "Hold the creator token to access this group",
          },
          403
        );
      }
      return c.json(
        {
          success: false,
          message: "Chat not found",
        },
        404
      );
    }

    c.set("currentUserId", user.id);
    c.set("chatId", membership.chatId);
    c.set("chatType", membership.chatType);
    c.set("chatAdminId", membership.chatAdminId);

    await next();
  } catch (error) {
    console.error("Chat member middleware error:", error);
    const temporaryNetworkError = /ECONNRESET|socket connection was closed|fetch failed|Failed to fetch|network/i.test(String(error));
    return c.json(
      {
        success: false,
        message: temporaryNetworkError
          ? "Chat access is temporarily unavailable. Please try again."
          : "Failed to verify chat access",
      },
      temporaryNetworkError ? 503 : 500
    );
  }
}

export async function groupAdminMiddleware(c: Context<AppEnv>, next: Next) {
  if (c.get("chatType") !== "GROUP") {
    return c.json(
      {
        success: false,
        message: "Only group chats can be managed",
      },
      400
    );
  }

  if (c.get("chatAdminId") !== c.get("currentUserId")) {
    return c.json(
      {
        success: false,
        message: "Only the group admin can manage members",
      },
      403
    );
  }

  await next();
}
