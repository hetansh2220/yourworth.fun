import type { Context } from "hono";
import { desc, eq, lt } from "drizzle-orm";

import { db } from "../db";
import { uploadAvatarFile } from "../lib/upload-avatar";
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
  const formData = await c.req.formData().catch(() => null);

  if (!formData) {
    return c.json(
      {
        success: false,
        message: "Invalid form data",
      },
      400
    );
  }

  const username = formData.get("username");
  const bio = formData.get("bio");
  const avatar = formData.get("avatar");
  const parsedBody = createUserSchema.safeParse({
    username: typeof username === "string" ? username : "",
    bio: typeof bio === "string" ? bio : "",
  });

  if (!parsedBody.success) {
    return c.json(
      {
        success: false,
        message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
      },
      400
    );
  }

  if (!(avatar instanceof File) || avatar.size === 0) {
    return c.json(
      {
        success: false,
        message: "Avatar image is required",
      },
      400
    );
  }

  try {
    const privyUserId = c.get("privyUserId");
    const walletAddress = c.get("walletAddress");
    const cleanUsername = parsedBody.data.username.trim().toLowerCase();
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

    const uploadedAvatar = await uploadAvatarFile(avatar);

    const [newUser] = await db
      .insert(users)
      .values({
        privyUserId,
        username: cleanUsername,
        walletAddress,
        avatar: uploadedAvatar.secure_url,
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

    if (error instanceof Error) {
      if (error.message === "Avatar must be an image") {
        return c.json(
          {
            success: false,
            message: error.message,
          },
          400
        );
      }

      if (error.message === "Avatar must be smaller than 5MB") {
        return c.json(
          {
            success: false,
            message: error.message,
          },
          413
        );
      }

      if (error.message === "Missing CLOUDINARY_UPLOAD_PRESET") {
        return c.json(
          {
            success: false,
            message: "Avatar upload is not configured",
          },
          500
        );
      }
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
        bio: users.bio,
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