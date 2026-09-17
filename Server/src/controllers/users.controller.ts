import type { Context } from "hono";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { createUserSchema, updateUserSchema, users } from "../db/schema";
import type { AppEnv } from "../types/app";

function getErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "";
}

function getUsernameParam(c: Context<AppEnv>) {
  return (c.req.param().username ?? "").trim().toLowerCase();
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
    const walletAddress = c.get("walletAddress");
    const cleanUsername = parsedBody.data.username.trim().toLowerCase();

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.privyUserId, privyUserId))
      .limit(1);

    if (existingUser) {
      return c.json(
        {
          success: false,
          message: "User already exists",
        },
        409
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

    const avatar = `https://api.dicebear.com/10.x/waves/svg?seed=${encodeURIComponent(
      cleanUsername
    )}`;

    const [newUser] = await db
      .insert(users)
      .values({
        privyUserId,
        username: cleanUsername,
        walletAddress,
        avatar,
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

export async function getUserByUsername(c: Context<AppEnv>) {
  const username = getUsernameParam(c);

  if (!username) {
    return c.json(
      {
        success: false,
        message: "Username is required",
      },
      400
    );
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        avatar: users.avatar,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.username, username))
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
    console.error("Get user by username error:", error);
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
  try {
    const usersList = await db
      .select({
        id: users.id,
        username: users.username,
        avatar: users.avatar,
        createdAt: users.createdAt,
      })
      .from(users);

    return c.json(
      {
        success: true,
        users: usersList,
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
  const updateValues: Partial<typeof users.$inferInsert> = {};

  if (cleanUsername) {
    updateValues.username = cleanUsername;
  }

  if (parsedBody.data.avatar) {
    updateValues.avatar = parsedBody.data.avatar;
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