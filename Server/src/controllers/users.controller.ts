import type { Context } from "hono";
import { desc, eq, lt, getTableColumns } from "drizzle-orm";

import { db } from "@/db";
import { createUserSchema, updateUserSchema, users, socials } from "@/db/schema";
import type { AppEnv } from "@/types/app";
import { PublicKey } from "@solana/web3.js";
import { unpackAccount } from "@solana/spl-token";
import { USDC_MINT } from "@/constants";
import connection from "@/lib/connection";

const socialFields = {
  twitterUsername: socials.twitterUsername,
  instagramUsername: socials.instagramUsername,
  youtubeUsername: socials.youtubeUsername,
};

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
      400,
    );
  }

  try {
    const walletAddress = c.get("walletAddress");

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
    const cleanName = parsedBody.data.name.trim();
    const cleanBio = parsedBody.data.bio.trim();

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.address, walletAddress))
      .limit(1);

    if (existingUser) {
      return c.json(
        {
          success: true,
          message: "User already exists",
          user: existingUser,
        },
        200,
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
        409,
      );
    }

    const [newUser] = await db
      .insert(users)
      .values({
        username: cleanUsername,
        name: cleanName,
        address: walletAddress,
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
      201,
    );
  } catch (error) {
    console.error("Create user error:", error);

    if (getErrorCode(error) === "23505") {
      return c.json(
        {
          success: false,
          message: "Username or wallet already exists",
        },
        409,
      );
    }

    return c.json(
      {
        success: false,
        message: "Failed to create user",
      },
      500,
    );
  }
}

export async function getMe(c: Context<AppEnv>) {
  const walletAddress = c.get("walletAddress");

  try {
    const [user] = await db
      .select({ ...getTableColumns(users), socials: socialFields })
      .from(users)
      .leftJoin(socials, eq(socials.userId, users.id))
      .where(eq(users.address, walletAddress))
      .limit(1);

    if (!user) {
      return c.json(
        {
          success: false,
          message: "User not found",
        },
        404,
      );
    }

    return c.json(
      {
        success: true,
        user,
      },
      200,
    );
  } catch (error) {
    console.error("Get user error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve user",
      },
      500,
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
      400,
    );
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        token: users.token,
        avatar: users.avatar,
        bio: users.bio,
        createdAt: users.createdAt,
        socials: socialFields,
      })
      .from(users)
      .leftJoin(socials, eq(socials.userId, users.id))
      .where(eq(users.token, token))
      .limit(1);

    if (!user) {
      return c.json(
        {
          success: false,
          message: "User not found",
        },
        404,
      );
    }

    return c.json(
      {
        success: true,
        user,
      },
      200,
    );
  } catch (error) {
    console.error("Get user by token error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve user",
      },
      500,
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
    name: users.name,
    avatar: users.avatar,
    bio: users.bio,
    verified: users.verified,
    createdAt: users.createdAt,
    socials: socialFields,
  };

  try {
    const usersList = validCursor
      ? await db
          .select(publicUserFields)
          .from(users)
      .leftJoin(socials, eq(socials.userId, users.id))
          .where(lt(users.createdAt, validCursor))
          .orderBy(desc(users.createdAt))
          .limit(limit + 1)
      : await db
          .select(publicUserFields)
          .from(users)
      .leftJoin(socials, eq(socials.userId, users.id))
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
      200,
    );
  } catch (error) {
    console.error("Get users error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve users",
      },
      500,
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
  const walletAddress = c.get("walletAddress");
  const body = await c.req.json().catch(() => null);
  const parsedBody = updateUserSchema.safeParse(body);

  if (!parsedBody.success) {
    return c.json(
      {
        success: false,
        message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
      },
      400,
    );
  }

  const cleanUsername = parsedBody.data.username?.trim().toLowerCase();
  const cleanName = parsedBody.data.name?.trim();
  const updateValues: Partial<typeof users.$inferInsert> = {};

  if (cleanUsername) {
    updateValues.username = cleanUsername;
  }

  if (cleanName) updateValues.name = cleanName;

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
      400,
    );
  }

  try {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.address, walletAddress))
      .limit(1);

    if (!existingUser) {
      return c.json(
        {
          success: false,
          message: "User not found",
        },
        404,
      );
    }

    if (cleanUsername) {
      const [usernameTaken] = await db
        .select()
        .from(users)
        .where(eq(users.username, cleanUsername))
        .limit(1);

      if (usernameTaken && usernameTaken.address !== walletAddress) {
        return c.json(
          {
            success: false,
            message: "Username already taken",
          },
          409,
        );
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({ ...updateValues, updatedAt: new Date() })
      .where(eq(users.address, walletAddress))
      .returning();

    return c.json(
      {
        success: true,
        message: "User updated successfully",
        user: updatedUser,
      },
      200,
    );
  } catch (error) {
    console.error("Update user error:", error);

    if (getErrorCode(error) === "23505") {
      return c.json(
        {
          success: false,
          message: "Username already exists",
        },
        409,
      );
    }

    return c.json(
      {
        success: false,
        message: "Failed to update user",
      },
      500,
    );
  }
}

/** Returns the authenticated wallet's USDC balance. */
export async function getUserBalance(c: Context<AppEnv>) {
  const address = c.get("walletAddress");
  if (!address) {
    return c.json({ success: false, message: "Unauthorized" }, 401);
  }

  try {
    const balance = await getUsdcBalance(address);
    return c.json({ success: true, balance }, 200);
  } catch (error) {
    console.error("Get USDC balance error:", error);
    return c.json(
      { success: false, message: "Failed to retrieve USDC balance" },
      500,
    );
  }
}

/** Returns the wallet's total USDC balance in USDC units (not base units). */
async function getUsdcBalance(address: string | PublicKey): Promise<number> {
  const owner = typeof address === "string" ? new PublicKey(address) : address;
  const accounts = await connection.getTokenAccountsByOwner(
    owner,
    { mint: new PublicKey(USDC_MINT) },
    "confirmed",
  );

  const amount = accounts.value.reduce(
    (total, account) =>
      total + unpackAccount(account.pubkey, account.account).amount,
    0n,
  );

  return Number(amount) / 1_000_000;
}

