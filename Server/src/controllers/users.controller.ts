import type { Context } from "hono";
import { desc, eq, lt } from "drizzle-orm";

import { db } from "../db";
import { cloudinary } from "../lib/cloudinary";
import { uploadAvatarFile } from "../lib/upload-avatar";
import { createUserSchema, updateUserSchema, users } from "../db/schema";
import type { AppEnv } from "../types/app";
import { createHash, createHmac, randomBytes } from "node:crypto";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function signXState(value: string) {
  const secret = process.env.X_STATE_SECRET ?? process.env.X_CLIENT_SECRET;
  if (!secret) throw new Error("X_STATE_SECRET is not configured");
  return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`;
}

function readXState(state: string) {
  const [value, signature] = state.split(".");
  const secret = process.env.X_STATE_SECRET ?? process.env.X_CLIENT_SECRET;
  if (!value || !signature || !secret) return null;
  const expected = createHmac("sha256", secret).update(value).digest("base64url");
  return expected === signature ? JSON.parse(Buffer.from(value, "base64url").toString()) as { privyUserId: string; verifier: string } : null;
}

export async function startXConnection(c: Context<AppEnv>) {
  const clientId = process.env.X_CLIENT_ID;
  const redirectUri = process.env.X_REDIRECT_URI;
  if (!clientId || !redirectUri) return c.json({ success: false, message: "X OAuth is not configured" }, 500);
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = signXState(Buffer.from(JSON.stringify({ privyUserId: c.get("privyUserId"), verifier })).toString("base64url"));
  const url = new URL("https://twitter.com/i/oauth2/authorize");
  url.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: "users.read tweet.read", state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
  return c.json({ success: true, url: url.toString() });
}

export async function completeXConnection(c: Context<AppEnv>) {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const parsed = state ? readXState(state) : null;
  if (!code || !parsed) return c.redirect(`${process.env.CLIENT_ORIGIN ?? "http://localhost:3000"}/create-market?x=error`);
  try {
    const basic = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64");
    const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, grant_type: "authorization_code", redirect_uri: process.env.X_REDIRECT_URI ?? "", code_verifier: parsed.verifier }) });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) throw new Error("X token exchange failed");
    const profileResponse = await fetch("https://api.x.com/2/users/me", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json() as { data?: { id: string; username: string } };
    if (!profile.data) throw new Error("X profile lookup failed");
    await db.update(users).set({ xConnected: true, xUserId: profile.data.id, xUsername: profile.data.username, updatedAt: new Date() }).where(eq(users.privyUserId, parsed.privyUserId));
    return c.redirect(`${process.env.CLIENT_ORIGIN ?? "http://localhost:3000"}/create-market?x=connected`);
  } catch (error) {
    console.error("X connection error:", error);
    return c.redirect(`${process.env.CLIENT_ORIGIN ?? "http://localhost:3000"}/create-market?x=error`);
  }
}

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
    const displayName = formData.get("displayName");
  const bio = formData.get("bio");
  const avatar = formData.get("avatar");
  const parsedBody = createUserSchema.safeParse({
    username: typeof username === "string" ? username : "",
    displayName: typeof displayName === "string" ? displayName : "",
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

  let uploadedAvatar: Awaited<ReturnType<typeof uploadAvatarFile>> | null = null;

  try {
    const privyUserId = c.get("privyUserId");
    const walletAddress = c.get("walletAddress");
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

    uploadedAvatar = await uploadAvatarFile(avatar);

    const [newUser] = await db
      .insert(users)
      .values({
        privyUserId,
        username: cleanUsername,
        displayName: cleanDisplayName,
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

    if (uploadedAvatar?.public_id) {
      try {
        await cloudinary.uploader.destroy(uploadedAvatar.public_id, {
          resource_type: "image",
          invalidate: true,
        });
      } catch (cleanupError) {
        console.error("Avatar cleanup error:", cleanupError);
      }
    }

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
        displayName: users.displayName,
        xConnected: users.xConnected,
        xUsername: users.xUsername,
        token: users.token,
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

export async function syncWallet(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => null) as { walletAddress?: unknown } | null;
  const walletAddress = typeof body?.walletAddress === "string" ? body.walletAddress.trim() : "";
  if (!walletAddress) return c.json({ success: false, message: "Wallet address is required" }, 400);

  try {
    const privyUser = await (await import("../lib/privy")).privy.users()._get(c.get("privyUserId"));
    const linkedWallet = privyUser.linked_accounts.find((account) =>
      isRecord(account) && account.type === "wallet" && account.chain_type === "solana" && account.address === walletAddress,
    );
    if (!linkedWallet) return c.json({ success: false, message: "Wallet is not linked to this Privy account" }, 403);

    const [updatedUser] = await db.update(users)
      .set({ walletAddress, updatedAt: new Date() })
      .where(eq(users.privyUserId, c.get("privyUserId")))
      .returning();
    return c.json({ success: true, user: updatedUser }, 200);
  } catch (error) {
    console.error("Sync wallet error:", error);
    return c.json({ success: false, message: "Failed to sync wallet" }, 500);
  }
}
