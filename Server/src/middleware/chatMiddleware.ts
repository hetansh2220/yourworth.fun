import type { Context, Next } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { chatMembers, chats, users } from "../db/schema";
import type { AppEnv } from "../types/app";

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

    const [membership] = await db
      .select({
        chatId: chats.id,
        chatType: chats.type,
        chatAdminId: chats.admin,
      })
      .from(chatMembers)
      .innerJoin(chats, eq(chatMembers.chatId, chats.id))
      .where(
        and(
          eq(chatMembers.chatId, parsedChatId.data),
          eq(chatMembers.userId, user.id)
        )
      )
      .limit(1);

    if (!membership) {
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
    return c.json(
      {
        success: false,
        message: "Failed to verify chat access",
      },
      500
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
