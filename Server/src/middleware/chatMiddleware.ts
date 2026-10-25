import type { Context, Next } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { chatMembers, chats, users } from "@/db/schema";
import type { AppEnv } from "@/types/app";

export async function chatMemberMiddleware(c: Context<AppEnv>, next: Next) {
  const chatId = z.string().uuid().safeParse(c.req.param("chatId"));

  if (!chatId.success) {
    return c.json({ success: false, message: "Chat id is invalid" }, 400);
  }

  try {
    const [membership] = await db
      .select({
        userId: chatMembers.userId,
        chatId: chatMembers.chatId,
        chatType: chats.type,
        chatAdminId: chats.admin,
      })
      .from(chatMembers)
      .innerJoin(users, eq(chatMembers.userId, users.id))
      .innerJoin(chats, eq(chatMembers.chatId, chats.id))
      .where(
        and(
          eq(chatMembers.chatId, chatId.data),
          eq(users.address, c.get("walletAddress")),
        ),
      )
      .limit(1);

    if (!membership) {
      return c.json(
        { success: false, message: "You are not a member of this chat" },
        403,
      );
    }

    c.set("currentUserId", membership.userId);
    c.set("chatId", membership.chatId);
    c.set("chatType", membership.chatType);
    c.set("chatAdminId", membership.chatAdminId);
  } catch (error) {
    console.error("Chat membership check error:", error);
    return c.json(
      { success: false, message: "Failed to verify chat membership" },
      500,
    );
  }

  await next();
}
