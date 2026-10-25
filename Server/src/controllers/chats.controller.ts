import type { Context } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { chatMembers, chats, users } from "../db/schema";
import { walletHoldsToken } from "../lib/solana/token-holdings";
import { publishChatEvent } from "../lib/chat/pubsub";
import {
  chatFields,
  getChatMembersMap,
  getChatWithMembers,
  getCurrentUser,
  getExistingDmChatId,
  getGroupMarketByCreatorId,
  getPrivateGroupChatId,
  getUnreadCounts,
  getUserById,
  getUserByUsername,
} from "../lib/chat/chat-helpers";
import type { AppEnv } from "../types/app";

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

const joinPrivateGroupSchema = z
  .object({
    creatorId: z.string().uuid().optional(),
    username: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.creatorId || data.username, {
    message: "Creator id or username is required",
  });

function getErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "";
}

async function createPrivateGroupChat(creatorId: string) {
  const newChat = await db.transaction(async (tx) => {
    const [createdChat] = await tx
      .insert(chats)
      .values({ type: "GROUP", admin: creatorId })
      .onConflictDoNothing()
      .returning({ id: chats.id });

    if (!createdChat) return null;

    await tx
      .insert(chatMembers)
      .values({ chatId: createdChat.id, userId: creatorId })
      .onConflictDoNothing();
    return createdChat;
  });

  if (!newChat) {
    const existingChatId = await getPrivateGroupChatId(creatorId);

    if (!existingChatId) {
      throw new Error("Failed to create private group chat");
    }

    return existingChatId;
  }

  return newChat.id;
}

export async function ensurePrivateGroupForCreator(creatorId: string) {
  const groupMarket = await getGroupMarketByCreatorId(creatorId);
  if (!groupMarket || groupMarket.paymentType !== "CREATOR_TOKEN") return null;
  return getOrCreatePrivateGroupChatId(creatorId);
}

async function getOrCreatePrivateGroupChatId(creatorId: string) {
  const existingChatId = await getPrivateGroupChatId(creatorId);

  if (existingChatId) {
    return existingChatId;
  }

  return createPrivateGroupChat(creatorId);
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
      400,
    );
  }

  try {
    const currentUser = await getCurrentUser(c.get("walletAddress"));

    if (!currentUser) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404,
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
        404,
      );
    }

    if (targetUser.id === currentUser.id) {
      return c.json(
        {
          success: false,
          message: "You cannot create a DM with yourself",
        },
        400,
      );
    }

    const existingChatId = await getExistingDmChatId(
      currentUser.id,
      targetUser.id,
    );

    if (existingChatId) {
      const chat = await getChatWithMembers(existingChatId);

      return c.json(
        {
          success: true,
          message: "DM chat already exists",
          chat,
        },
        200,
      );
    }

    const newChat = await db.transaction(async (tx) => {
      const [createdChat] = await tx
        .insert(chats)
        .values({ type: "DM", admin: currentUser.id })
        .returning({ id: chats.id });

      if (!createdChat) throw new Error("Failed to create chat");

      await tx.insert(chatMembers).values([
        { chatId: createdChat.id, userId: currentUser.id },
        { chatId: createdChat.id, userId: targetUser.id },
      ]);

      return createdChat;
    });

    const chat = await getChatWithMembers(newChat.id);

    return c.json(
      {
        success: true,
        message: "DM chat created successfully",
        chat,
      },
      201,
    );
  } catch (error) {
    console.error("Create DM chat error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to create DM chat",
      },
      500,
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
      400,
    );
  }

  try {
    const currentUser = await getCurrentUser(c.get("walletAddress"));

    if (!currentUser) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404,
      );
    }

    const memberIds = Array.from(
      new Set(parsedBody.data.memberIds.filter((id) => id !== currentUser.id)),
    );

    if (memberIds.length === 0) {
      return c.json(
        {
          success: false,
          message: "Group requires at least one other member",
        },
        400,
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
        404,
      );
    }

    const newChat = await db.transaction(async (tx) => {
      const [createdChat] = await tx
        .insert(chats)
        .values({ type: "GROUP", admin: currentUser.id })
        .returning({ id: chats.id });

      if (!createdChat) throw new Error("Failed to create chat");

      await tx
        .insert(chatMembers)
        .values([
          { chatId: createdChat.id, userId: currentUser.id },
          ...memberIds.map((userId) => ({ chatId: createdChat.id, userId })),
        ]);

      return createdChat;
    });

    const chat = await getChatWithMembers(newChat.id);

    return c.json(
      {
        success: true,
        message: "Group chat created successfully",
        chat,
      },
      201,
    );
  } catch (error) {
    if (getErrorCode(error) === "23505") {
      return c.json({ success: false, message: "You already have a group chat" }, 409);
    }
    console.error("Create group chat error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to create group chat",
      },
      500,
    );
  }
}

export async function getOrCreateMyPrivateGroup(c: Context<AppEnv>) {
  try {
    const currentUser = await getCurrentUser(c.get("walletAddress"));

    if (!currentUser) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404,
      );
    }

    const groupMarket = await getGroupMarketByCreatorId(currentUser.id);

    if (!groupMarket) {
      return c.json(
        {
          success: false,
          message: "Create your group market first",
        },
        404,
      );
    }

    if (groupMarket.paymentType !== "CREATOR_TOKEN") {
      return c.json(
        {
          success: false,
          message: "Private groups require creator token access",
        },
        400,
      );
    }

    if (!currentUser.token) {
      return c.json(
        {
          success: false,
          message: "Launch your creator token first",
        },
        400,
      );
    }

    const chatId = await ensurePrivateGroupForCreator(currentUser.id);
    if (!chatId)
      return c.json(
        { success: false, message: "Private group is not configured" },
        404,
      );
    const chat = await getChatWithMembers(chatId);

    return c.json(
      {
        success: true,
        message: "Private group ready",
        chat,
      },
      200,
    );
  } catch (error) {
    console.error("Get or create private group error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to prepare private group",
      },
      500,
    );
  }
}

export async function joinPrivateGroup(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => null);
  const parsedBody = joinPrivateGroupSchema.safeParse(body);

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
    const currentUser = await getCurrentUser(c.get("walletAddress"));

    if (!currentUser) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404,
      );
    }

    const creator = parsedBody.data.creatorId
      ? await getUserById(parsedBody.data.creatorId)
      : await getUserByUsername(parsedBody.data.username ?? "");

    if (!creator) {
      return c.json(
        {
          success: false,
          message: "Creator not found",
        },
        404,
      );
    }

    const groupMarket = await getGroupMarketByCreatorId(creator.id);

    if (!groupMarket || groupMarket.paymentType !== "CREATOR_TOKEN") {
      return c.json(
        {
          success: false,
          message: "Creator private group is not available",
        },
        404,
      );
    }

    if (!creator.token) {
      return c.json(
        {
          success: false,
          message: "Creator token is not launched",
        },
        400,
      );
    }

    const hasAccess =
      currentUser.id === creator.id ||
      (await walletHoldsToken({
        walletAddress: currentUser.address,
        mintAddress: creator.token,
      }));

    if (!hasAccess) {
      return c.json(
        {
          success: false,
          message: "Creator token required to join this group",
        },
        403,
      );
    }

    const chatId = await getOrCreatePrivateGroupChatId(creator.id);

    await db
      .insert(chatMembers)
      .values({
        chatId,
        userId: currentUser.id,
      })
      .onConflictDoNothing();

    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, chatId));

    const chat = await getChatWithMembers(chatId);

    return c.json(
      {
        success: true,
        message: "Private group joined",
        chat,
      },
      200,
    );
  } catch (error) {
    console.error("Join private group error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to join private group",
      },
      500,
    );
  }
}

export async function getMyChats(c: Context<AppEnv>) {
  try {
    const currentUser = await getCurrentUser(c.get("walletAddress"));

    if (!currentUser) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404,
      );
    }

    // Repair groups for creators whose token was launched before the group
    // creation hook existed. This also makes the creator appear in their own
    // private group without requiring them to hold their token.
    if (currentUser.token) {
      await ensurePrivateGroupForCreator(currentUser.id);
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

    const tokenOwnership = new Map<string, Promise<boolean>>();
    const ownsToken = (token: string) => {
      const existing = tokenOwnership.get(token);
      if (existing) return existing;
      const check = walletHoldsToken({
        walletAddress: currentUser.address,
        mintAddress: token,
      });
      tokenOwnership.set(token, check);
      return check;
    };

    const creatorIds = Array.from(
      new Set(
        chatRows
          .filter(
            (chat) =>
              chat.type === "GROUP" &&
              chat.admin &&
              chat.admin !== currentUser.id,
          )
          .map((chat) => chat.admin as string),
      ),
    );
    const creatorRows =
      creatorIds.length > 0
        ? await db
            .select({ id: users.id, token: users.token })
            .from(users)
            .where(inArray(users.id, creatorIds))
        : [];
    const creatorTokens = new Map(
      creatorRows.map((creator) => [creator.id, creator.token]),
    );

    const expiredGroupIds = (
      await Promise.all(
        chatRows.map(async (chat) => {
          if (
            chat.type !== "GROUP" ||
            !chat.admin ||
            chat.admin === currentUser.id
          )
            return null;
          const token = creatorTokens.get(chat.admin);
          const hasToken = Boolean(token) && (await ownsToken(token ?? ""));
          return hasToken ? null : chat.id;
        }),
      )
    ).filter((chatId): chatId is string => Boolean(chatId));

    if (expiredGroupIds.length > 0) {
      await db
        .delete(chatMembers)
        .where(
          and(
            eq(chatMembers.userId, currentUser.id),
            inArray(chatMembers.chatId, expiredGroupIds),
          ),
        );
    }
    const activeChatRows = chatRows.filter(
      (chat) => !expiredGroupIds.includes(chat.id),
    );

    const chatIds = activeChatRows.map((chat) => chat.id);
    const membersByChatId = await getChatMembersMap(chatIds);
    const unreadCounts = await getUnreadCounts(activeChatRows, currentUser.id);

    return c.json(
      {
        success: true,
        chats: activeChatRows.map(({ lastReadAt, ...chat }) => ({
          ...chat,
          lastReadAt,
          unreadCount: unreadCounts.get(chat.id) ?? 0,
          members: membersByChatId.get(chat.id) ?? [],
        })),
      },
      200,
    );
  } catch (error) {
    console.error("Get my chats error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve chats",
      },
      500,
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
        404,
      );
    }

    return c.json(
      {
        success: true,
        chat,
      },
      200,
    );
  } catch (error) {
    console.error("Get chat error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve chat",
      },
      500,
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
      400,
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
        404,
      );
    }

    const chat = await getChatWithMembers(c.get("chatId"));

    if (chat?.admin) {
      const creator = await getUserById(chat.admin);

      if (!creator?.token) {
        return c.json(
          {
            success: false,
            message: "Creator token is not launched",
          },
          400,
        );
      }

      const hasAccess =
        member.id === chat.admin ||
        (await walletHoldsToken({
          walletAddress: member.address,
          mintAddress: creator.token,
        }));

      if (!hasAccess) {
        return c.json(
          {
            success: false,
            message: "Creator token required to join this group",
          },
          403,
        );
      }
    }

    await db.insert(chatMembers).values({
      chatId: c.get("chatId"),
      userId: member.id,
    });

    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, c.get("chatId")));

    const updatedChat = await getChatWithMembers(c.get("chatId"));

    return c.json(
      {
        success: true,
        message: "Group member added successfully",
        chat: updatedChat,
      },
      201,
    );
  } catch (error) {
    console.error("Add group member error:", error);

    if (getErrorCode(error) === "23505") {
      return c.json(
        {
          success: false,
          message: "Member already exists",
        },
        409,
      );
    }

    return c.json(
      {
        success: false,
        message: "Failed to add group member",
      },
      500,
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
      400,
    );
  }

  if (parsedUserId.data === c.get("chatAdminId")) {
    return c.json(
      {
        success: false,
        message: "Group admin cannot be removed",
      },
      400,
    );
  }

  try {
    const [removedMember] = await db
      .delete(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, c.get("chatId")),
          eq(chatMembers.userId, parsedUserId.data),
        ),
      )
      .returning({ id: chatMembers.id });

    if (!removedMember) {
      return c.json(
        {
          success: false,
          message: "Member not found",
        },
        404,
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
      200,
    );
  } catch (error) {
    console.error("Remove group member error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to remove group member",
      },
      500,
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
          eq(chatMembers.userId, c.get("currentUserId")),
        ),
      )
      .returning({ id: chatMembers.id, lastReadAt: chatMembers.lastReadAt });

    if (!membership) {
      return c.json(
        {
          success: false,
          message: "Chat not found",
        },
        404,
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
      200,
    );
  } catch (error) {
    console.error("Mark chat read error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to mark chat as read",
      },
      500,
    );
  }
}
