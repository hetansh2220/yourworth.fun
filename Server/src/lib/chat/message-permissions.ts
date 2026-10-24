import { and, eq, inArray } from "drizzle-orm";

import { db } from "../../db";
import { chatMembers, chats, markets } from "../../db/schema";

type MessageOwner = { senderId: string; deletedAt: Date | null };

export async function canSendDmMessage(chatId: string, userId: string) {
  const [chat] = await db.select({ type: chats.type }).from(chats).where(eq(chats.id, chatId)).limit(1);
  if (!chat || chat.type !== "DM") return true;

  const members = await db.select({ userId: chatMembers.userId }).from(chatMembers).where(eq(chatMembers.chatId, chatId));
  const memberIds = members.map((member) => member.userId);
  const [creatorMarket] = await db
    .select({ userId: markets.userId })
    .from(markets)
    .where(and(eq(markets.marketType, "dm"), inArray(markets.userId, memberIds)))
    .limit(1);

  return creatorMarket?.userId === userId;
}

export function canEditMessage(message: MessageOwner | undefined, userId: string) {
  return Boolean(message && !message.deletedAt && message.senderId === userId);
}

export function canDeleteMessage(message: MessageOwner | undefined, userId: string, adminId: string) {
  return Boolean(message && (message.senderId === userId || adminId === userId));
}
