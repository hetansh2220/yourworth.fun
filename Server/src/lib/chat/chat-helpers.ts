import { and, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { db } from "../../db";
import { chatMembers, chats, markets, messages, users } from "../../db/schema";
import { walletHoldsToken } from "../solana/token-holdings";

export const userFields = {
  id: users.id,
  username: users.username,
  name: users.name,
  avatar: users.avatar,
  bio: users.bio,
};

export const chatFields = {
  id: chats.id,
  type: chats.type,
  admin: chats.admin,
  createdAt: chats.createdAt,
  updatedAt: chats.updatedAt,
};

export type ChatMember = {
  user: {
    id: string;
    username: string;
    name: string;
    avatar: string;
    bio: string;
  };
  joinedAt: Date;
  lastReadAt: Date | null;
};

export function isTransientNetworkError(error: unknown) {
  const message = String(error);
  return /ECONNRESET|socket connection was closed|fetch failed|Failed to fetch|network/i.test(
    message,
  );
}

async function withNetworkRetry<T>(operation: () => Promise<T>, attempts = 2) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  throw lastError;
}

export async function getCurrentUser(walletAddress: string) {
  const [user] = await withNetworkRetry(() =>
    db.select().from(users).where(eq(users.address, walletAddress)).limit(1),
  );

  return user;
}

export async function getUserById(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user;
}

export async function getUserByUsername(username: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.replace(/^@/, "").toLowerCase()))
    .limit(1);

  return user;
}

export async function getChatMembersMap(chatIds: string[]) {
  const membersByChatId = new Map<string, ChatMember[]>();
  if (chatIds.length === 0) return membersByChatId;

  const memberRows = await db
    .select({
      chatId: chatMembers.chatId,
      user: userFields,
      joinedAt: chatMembers.joinedAt,
      lastReadAt: chatMembers.lastReadAt,
    })
    .from(chatMembers)
    .innerJoin(users, eq(chatMembers.userId, users.id))
    .where(inArray(chatMembers.chatId, chatIds))
    .orderBy(chatMembers.joinedAt);

  for (const member of memberRows) {
    const current = membersByChatId.get(member.chatId) ?? [];
    current.push({
      user: member.user,
      joinedAt: member.joinedAt,
      lastReadAt: member.lastReadAt,
    });
    membersByChatId.set(member.chatId, current);
  }

  return membersByChatId;
}

export async function getUnreadCounts(
  chatsToCount: Array<{ id: string; lastReadAt: Date | null }>,
  currentUserId: string,
) {
  const counts = new Map<string, number>();
  if (chatsToCount.length === 0) return counts;

  const conditions = chatsToCount.map(({ id, lastReadAt }) =>
    lastReadAt
      ? and(
          eq(messages.chatId, id),
          ne(messages.senderId, currentUserId),
          gt(messages.createdAt, lastReadAt),
          isNull(messages.deletedAt),
        )
      : and(
          eq(messages.chatId, id),
          ne(messages.senderId, currentUserId),
          isNull(messages.deletedAt),
        ),
  );

  const rows = await db
    .select({ chatId: messages.chatId, count: sql<number>`count(*)::int` })
    .from(messages)
    .where(or(...conditions))
    .groupBy(messages.chatId);

  for (const row of rows) counts.set(row.chatId, Number(row.count));
  return counts;
}

export async function getChatWithMembers(chatId: string) {
  const [chat] = await db
    .select(chatFields)
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);
  if (!chat) return null;

  const membersByChatId = await getChatMembersMap([chat.id]);
  return { ...chat, members: membersByChatId.get(chat.id) ?? [] };
}

export async function getChatAccess(chatId: string, userId: string) {
  const [membership] = await withNetworkRetry(() =>
    db
      .select({
        chatId: chats.id,
        chatType: chats.type,
        chatAdminId: chats.admin,
      })
      .from(chatMembers)
      .innerJoin(chats, eq(chatMembers.chatId, chats.id))
      .where(
        and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)),
      )
      .limit(1),
  );

  return membership;
}

export async function hasChatAccess(
  chatId: string,
  userId: string,
  walletAddress: string,
) {
  const access = await getChatAccess(chatId, userId);
  if (!access) return null;
  if (
    access.chatType !== "GROUP" ||
    !access.chatAdminId ||
    access.chatAdminId === userId
  )
    return access;

  const [creator] = await db
    .select({ token: users.token })
    .from(users)
    .where(eq(users.id, access.chatAdminId))
    .limit(1);
  const hasToken = creator?.token
    ? await walletHoldsToken({ walletAddress, mintAddress: creator.token })
    : false;
  return hasToken ? access : null;
}

export async function getGroupMarketByCreatorId(creatorId: string) {
  const [market] = await db
    .select({ id: markets.id, paymentType: markets.paymentType })
    .from(markets)
    .where(and(eq(markets.userId, creatorId), eq(markets.marketType, "GROUP")))
    .limit(1);

  return market;
}

export async function getPrivateGroupChatId(creatorId: string) {
  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.type, "GROUP"), eq(chats.admin, creatorId)))
    .limit(1);

  return chat?.id ?? null;
}

export async function getExistingDmChatId(
  currentUserId: string,
  targetUserId: string,
) {
  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(
      and(
        eq(chats.type, "DM"),
        sql`exists (select 1 from ${chatMembers} where ${chatMembers.chatId} = ${chats.id} and ${chatMembers.userId} = ${currentUserId})`,
        sql`exists (select 1 from ${chatMembers} where ${chatMembers.chatId} = ${chats.id} and ${chatMembers.userId} = ${targetUserId})`,
      ),
    )
    .limit(1);

  return chat?.id ?? null;
}

export async function getMessageOwner(messageId: string, chatId: string) {
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
