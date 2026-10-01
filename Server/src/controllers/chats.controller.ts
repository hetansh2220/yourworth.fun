import type { Context } from "hono";
import { and, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { chatMembers, chats, messages, users } from "../db/schema";
import { publishChatEvent } from "../lib/chat/pubsub";
import type { AppEnv } from "../types/app";

const userFields = {
  id: users.id,
  username: users.username,
  avatar: users.avatar,
  bio: users.bio,
};

const chatFields = {
  id: chats.id,
  type: chats.type,
  admin: chats.admin,
  createdAt: chats.createdAt,
  updatedAt: chats.updatedAt,
};

type ChatMember = {
  user: {
    id: string;
    username: string;
    avatar: string;
    bio: string;
  };
  joinedAt: Date;
  lastReadAt: Date | null;
};

const createDmSchema = z
  .object({
    userId: z.string().uuid().optional(),
    username: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.userId || data.username, {
    message: "User id or username is required",
  });

const createGroupSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1).max(50),
});

const addGroupMemberSchema = z.object({
  userId: z.string().uuid(),
});

function getErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "";
}

async function getCurrentUser(privyUserId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.privyUserId, privyUserId))
    .limit(1);

  return user;
}

async function getUserById(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user;
}

async function getUserByUsername(username: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.replace(/^@/, "").toLowerCase()))
    .limit(1);

  return user;
}

async function getChatMembersMap(chatIds: string[]) {
  const membersByChatId = new Map<string, ChatMember[]>();

  if (chatIds.length === 0) {
    return membersByChatId;
  }

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
    const currentMembers = membersByChatId.get(member.chatId) ?? [];
    currentMembers.push({
      user: member.user,
      joinedAt: member.joinedAt,
      lastReadAt: member.lastReadAt,
    });
    membersByChatId.set(member.chatId, currentMembers);
  }

  return membersByChatId;
}

async function getUnreadCount(
  chatId: string,
  currentUserId: string,
  lastReadAt: Date | null
) {
  const unreadWhere = lastReadAt
    ? and(
        eq(messages.chatId, chatId),
        ne(messages.senderId, currentUserId),
        gt(messages.createdAt, lastReadAt),
        isNull(messages.deletedAt)
      )
    : and(
        eq(messages.chatId, chatId),
        ne(messages.senderId, currentUserId),
        isNull(messages.deletedAt)
      );

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(unreadWhere);

  return Number(result?.count ?? 0);
}

async function getChatWithMembers(chatId: string) {
  const [chat] = await db
    .select(chatFields)
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);

  if (!chat) {
    return null;
  }

  const membersByChatId = await getChatMembersMap([chat.id]);

  return {
    ...chat,
    members: membersByChatId.get(chat.id) ?? [],
  };
}

async function getExistingDmChatId(currentUserId: string, targetUserId: string) {
  const [chat] = await db
    .select({
      id: chats.id,
    })
    .from(chats)
    .where(
      and(
        eq(chats.type, "DM"),
        sql`exists (select 1 from ${chatMembers} where ${chatMembers.chatId} = ${chats.id} and ${chatMembers.userId} = ${currentUserId})`,
        sql`exists (select 1 from ${chatMembers} where ${chatMembers.chatId} = ${chats.id} and ${chatMembers.userId} = ${targetUserId})`
      )
    )
    .limit(1);

  return chat?.id ?? null;
}

export async function createDmChat(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => null);
  const parsedBody = createDmSchema.safeParse(body);

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

    const targetUser = parsedBody.data.userId
      ? await getUserById(parsedBody.data.userId)
      : await getUserByUsername(parsedBody.data.username ?? "");

    if (!targetUser) {
      return c.json(
        {
          success: false,
          message: "User not found",
        },
        404
      );
    }

    if (targetUser.id === currentUser.id) {
      return c.json(
        {
          success: false,
          message: "You cannot create a DM with yourself",
        },
        400
      );
    }

    const existingChatId = await getExistingDmChatId(currentUser.id, targetUser.id);

    if (existingChatId) {
      const chat = await getChatWithMembers(existingChatId);

      return c.json(
        {
          success: true,
          message: "DM chat already exists",
          chat,
        },
        200
      );
    }

    const [newChat] = await db
      .insert(chats)
      .values({
        type: "DM",
        admin: currentUser.id,
      })
      .returning({ id: chats.id });

    if (!newChat) {
      throw new Error("Failed to create chat");
    }

    await db.insert(chatMembers).values([
      {
        chatId: newChat.id,
        userId: currentUser.id,
      },
      {
        chatId: newChat.id,
        userId: targetUser.id,
      },
    ]);

    const chat = await getChatWithMembers(newChat.id);

    return c.json(
      {
        success: true,
        message: "DM chat created successfully",
        chat,
      },
      201
    );
  } catch (error) {
    console.error("Create DM chat error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to create DM chat",
      },
      500
    );
  }
}

export async function createGroupChat(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => null);
  const parsedBody = createGroupSchema.safeParse(body);

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

    const memberIds = Array.from(
      new Set(parsedBody.data.memberIds.filter((id) => id !== currentUser.id))
    );

    if (memberIds.length === 0) {
      return c.json(
        {
          success: false,
          message: "Group requires at least one other member",
        },
        400
      );
    }

    const foundMembers = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, memberIds));

    if (foundMembers.length !== memberIds.length) {
      return c.json(
        {
          success: false,
          message: "One or more members were not found",
        },
        404
      );
    }

    const [newChat] = await db
      .insert(chats)
      .values({
        type: "GROUP",
        admin: currentUser.id,
      })
      .returning({ id: chats.id });

    if (!newChat) {
      throw new Error("Failed to create chat");
    }

    await db.insert(chatMembers).values([
      {
        chatId: newChat.id,
        userId: currentUser.id,
      },
      ...memberIds.map((userId) => ({
        chatId: newChat.id,
        userId,
      })),
    ]);

    const chat = await getChatWithMembers(newChat.id);

    return c.json(
      {
        success: true,
        message: "Group chat created successfully",
        chat,
      },
      201
    );
  } catch (error) {
    console.error("Create group chat error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to create group chat",
      },
      500
    );
  }
}

export async function getMyChats(c: Context<AppEnv>) {
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

    const chatRows = await db
      .select({
        ...chatFields,
        lastReadAt: chatMembers.lastReadAt,
      })
      .from(chatMembers)
      .innerJoin(chats, eq(chatMembers.chatId, chats.id))
      .where(eq(chatMembers.userId, currentUser.id))
      .orderBy(desc(chats.updatedAt));

    const chatIds = chatRows.map((chat) => chat.id);
    const membersByChatId = await getChatMembersMap(chatIds);
    const unreadCounts = new Map<string, number>();

    await Promise.all(
      chatRows.map(async (chat) => {
        unreadCounts.set(
          chat.id,
          await getUnreadCount(chat.id, currentUser.id, chat.lastReadAt)
        );
      })
    );

    return c.json(
      {
        success: true,
        chats: chatRows.map(({ lastReadAt, ...chat }) => ({
          ...chat,
          lastReadAt,
          unreadCount: unreadCounts.get(chat.id) ?? 0,
          members: membersByChatId.get(chat.id) ?? [],
        })),
      },
      200
    );
  } catch (error) {
    console.error("Get my chats error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve chats",
      },
      500
    );
  }
}

export async function getChatById(c: Context<AppEnv>) {
  try {
    const chat = await getChatWithMembers(c.get("chatId"));

    if (!chat) {
      return c.json(
        {
          success: false,
          message: "Chat not found",
        },
        404
      );
    }

    return c.json(
      {
        success: true,
        chat,
      },
      200
    );
  } catch (error) {
    console.error("Get chat error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve chat",
      },
      500
    );
  }
}

export async function addGroupMember(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => null);
  const parsedBody = addGroupMemberSchema.safeParse(body);

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
    const member = await getUserById(parsedBody.data.userId);

    if (!member) {
      return c.json(
        {
          success: false,
          message: "User not found",
        },
        404
      );
    }

    await db.insert(chatMembers).values({
      chatId: c.get("chatId"),
      userId: member.id,
    });

    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, c.get("chatId")));

    const chat = await getChatWithMembers(c.get("chatId"));

    return c.json(
      {
        success: true,
        message: "Group member added successfully",
        chat,
      },
      201
    );
  } catch (error) {
    console.error("Add group member error:", error);

    if (getErrorCode(error) === "23505") {
      return c.json(
        {
          success: false,
          message: "Member already exists",
        },
        409
      );
    }

    return c.json(
      {
        success: false,
        message: "Failed to add group member",
      },
      500
    );
  }
}

export async function removeGroupMember(c: Context<AppEnv>) {
  const parsedUserId = z.string().uuid().safeParse(c.req.param("userId"));

  if (!parsedUserId.success) {
    return c.json(
      {
        success: false,
        message: "User id is invalid",
      },
      400
    );
  }

  if (parsedUserId.data === c.get("chatAdminId")) {
    return c.json(
      {
        success: false,
        message: "Group admin cannot be removed",
      },
      400
    );
  }

  try {
    const [removedMember] = await db
      .delete(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, c.get("chatId")),
          eq(chatMembers.userId, parsedUserId.data)
        )
      )
      .returning({ id: chatMembers.id });

    if (!removedMember) {
      return c.json(
        {
          success: false,
          message: "Member not found",
        },
        404
      );
    }

    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, c.get("chatId")));

    return c.json(
      {
        success: true,
        message: "Group member removed successfully",
      },
      200
    );
  } catch (error) {
    console.error("Remove group member error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to remove group member",
      },
      500
    );
  }
}

export async function markChatRead(c: Context<AppEnv>) {
  try {
    const readAt = new Date();
    const [membership] = await db
      .update(chatMembers)
      .set({ lastReadAt: readAt })
      .where(
        and(
          eq(chatMembers.chatId, c.get("chatId")),
          eq(chatMembers.userId, c.get("currentUserId"))
        )
      )
      .returning({ id: chatMembers.id, lastReadAt: chatMembers.lastReadAt });

    if (!membership) {
      return c.json(
        {
          success: false,
          message: "Chat not found",
        },
        404
      );
    }

    publishChatEvent(c.get("chatId"), {
      type: "chat.read",
      chatId: c.get("chatId"),
      userId: c.get("currentUserId"),
      lastReadAt: membership.lastReadAt,
    });

    return c.json(
      {
        success: true,
        message: "Chat marked as read",
        lastReadAt: membership.lastReadAt,
      },
      200
    );
  } catch (error) {
    console.error("Mark chat read error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to mark chat as read",
      },
      500
    );
  }
}
