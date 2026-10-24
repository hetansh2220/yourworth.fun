import type { Context } from "hono";
import { desc, eq, lt } from "drizzle-orm";

import { db } from "../db";
import { createUserSchema, updateUserSchema, users } from "../db/schema";
import type { AppEnv } from "../types/app";
import { privy } from "../lib/privy";
import { getSolanaEmbeddedWalletAddress } from "../middleware/authMiddleware";

function getErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "";
}

function getTokenParam(c: Context<AppEnv>) {
  return (c.req.param().token ?? "").trim();
}

export async function createUser(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => null);
  const parsedBody = createUserSchema.safeParse(body);

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
    const privyUserId = c.get("privyUserId");
    const privyUser = await privy.users()._get(privyUserId);
    const walletAddress = getSolanaEmbeddedWalletAddress(
      privyUser.linked_accounts,
    );

    if (!walletAddress) {
      return c.json(
        {
          success: false,
          message: "Solana wallet is not ready",
        },
        400,
      );
    }
    const cleanUsername = parsedBody.data.username.trim().toLowerCase();
    const cleanDisplayName = parsedBody.data.displayName.trim();
    const cleanBio = parsedBody.data.bio.trim();

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.privyUserId, privyUserId))
      .limit(1);

    if (existingUser) {
      return c.json(
        {
          success: true,
          message: "User already exists",
          user: existingUser,
        },
        200
      );
    }

    const [usernameTaken] = await db
      .select()
      .from(users)
      .where(eq(users.username, cleanUsername))
      .limit(1);

    if (usernameTaken) {
      return c.json(
        {
          success: false,
          message: "Username already taken",
        },
        409
      );
    }

    const [newUser] = await db
      .insert(users)
      .values({
        privyUserId,
        username: cleanUsername,
        displayName: cleanDisplayName,
        walletAddress,
        avatar: parsedBody.data.avatar,
        bio: cleanBio,
      })
      .returning();

    return c.json(
      {
        success: true,
        message: "User created successfully",
        user: newUser,
      },
      201
    );
  } catch (error) {
    console.error("Create user error:", error);

    if (getErrorCode(error) === "23505") {
      return c.json(
        {
          success: false,
          message: "Username or wallet already exists",
        },
        409
      );
    }

    return c.json(
      {
        success: false,
        message: "Failed to create user",
      },
      500
    );
  }
}

export async function getMe(c: Context<AppEnv>) {
  const privyUserId = c.get("privyUserId");

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.privyUserId, privyUserId))
      .limit(1);

    if (!user) {
      return c.json(
        {
          success: false,
          message: "User not found",
        },
        404
      );
    }

    return c.json(
      {
        success: true,
        user,
      },
      200
    );
  } catch (error) {
    console.error("Get user error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve user",
      },
      500
    );
  }
}

export async function getUserByToken(c: Context<AppEnv>) {
  const token = getTokenParam(c);

  if (!token) {
    return c.json(
      {
        success: false,
        message: "Token parameter is required",
      },
      400
    );
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        token: users.token,
        avatar: users.avatar,
        bio: users.bio,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.token, token ))
      .limit(1);

    if (!user) {
      return c.json(
        {
          success: false,
          message: "User not found",
        },
        404
      );
    }

    return c.json(
      {
        success: true,
        user,
      },
      200
    );
  } catch (error) {
    console.error("Get user by token error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve user",
      },
      500
    );
  }
}

export async function getUsers(c: Context<AppEnv>) {
  const parsedLimit = Number(c.req.query("limit") ?? "20");
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 50)
    : 20;
  const cursor = c.req.query("cursor");
  const cursorDate = cursor ? new Date(cursor) : null;
  const validCursor =
    cursorDate && !Number.isNaN(cursorDate.getTime()) ? cursorDate : null;
  const publicUserFields = {
    id: users.id,
    username: users.username,
    xConnected: users.xConnected,
    xUsername: users.xUsername,
    displayName: users.displayName,
    avatar: users.avatar,
    bio: users.bio,
    createdAt: users.createdAt,
  };

  try {
    const usersList = validCursor
      ? await db
          .select(publicUserFields)
          .from(users)
          .where(lt(users.createdAt, validCursor))
          .orderBy(desc(users.createdAt))
          .limit(limit + 1)
      : await db
          .select(publicUserFields)
          .from(users)
          .orderBy(desc(users.createdAt))
          .limit(limit + 1);

    const visibleUsers = usersList.slice(0, limit);
    const lastUser = visibleUsers.at(-1);
    const nextCursor =
      usersList.length > limit && lastUser
        ? lastUser.createdAt.toISOString()
        : null;

    return c.json(
      {
        success: true,
        users: visibleUsers,
        nextCursor,
      },
      200
    );
  } catch (error) {
    console.error("Get users error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve users",
      },
      500
    );
  }
}

export async function checkUsernameAvailability(c: Context<AppEnv>) {
  const username = (c.req.query("username") ?? "").trim().toLowerCase();
  const parsed = createUserSchema.shape.username.safeParse(username);

  if (!parsed.success) {
    return c.json(
      { success: false, available: false, message: "Invalid username" },
      400,
    );
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, parsed.data))
    .limit(1);

  return c.json({ success: true, available: !existingUser }, 200);
}

export async function updateUser(c: Context<AppEnv>) {
  const privyUserId = c.get("privyUserId");
  const body = await c.req.json().catch(() => null);
  const parsedBody = updateUserSchema.safeParse(body);

  if (!parsedBody.success) {
    return c.json(
      {
        success: false,
        message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
      },
      400
    );
  }

  const cleanUsername = parsedBody.data.username?.trim().toLowerCase();
  const cleanDisplayName = parsedBody.data.displayName?.trim();
  const updateValues: Partial<typeof users.$inferInsert> = {};

  if (cleanUsername) {
    updateValues.username = cleanUsername;
  }

  if (cleanDisplayName) updateValues.displayName = cleanDisplayName;

  if (parsedBody.data.avatar) {
    updateValues.avatar = parsedBody.data.avatar;
  }

  if (parsedBody.data.bio) {
    updateValues.bio = parsedBody.data.bio.trim();
  }

  if (Object.keys(updateValues).length === 0) {
    return c.json(
      {
        success: false,
        message: "Nothing to update",
      },
      400
    );
  }

  try {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.privyUserId, privyUserId))
      .limit(1);

    if (!existingUser) {
      return c.json(
        {
          success: false,
          message: "User not found",
        },
        404
      );
    }

    if (cleanUsername) {
      const [usernameTaken] = await db
        .select()
        .from(users)
        .where(eq(users.username, cleanUsername))
        .limit(1);

      if (usernameTaken && usernameTaken.privyUserId !== privyUserId) {
        return c.json(
          {
            success: false,
            message: "Username already taken",
          },
          409
        );
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateValues)
      .where(eq(users.privyUserId, privyUserId))
      .returning();

    return c.json(
      {
        success: true,
        message: "User updated successfully",
        user: updatedUser,
      },
      200
    );
  } catch (error) {
    console.error("Update user error:", error);

    if (getErrorCode(error) === "23505") {
      return c.json(
        {
          success: false,
          message: "Username already exists",
        },
        409
      );
    }

    return c.json(
      {
        success: false,
        message: "Failed to update user",
      },
      500
    );
  }
}
