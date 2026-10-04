import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { users } from "../db/schema";
import { launchCreatorTokenDevnet } from "../lib/meteora/creator-token-launch";
import type { AppEnv } from "../types/app";

const creatorTokenLaunchSchema = z.object({
  name: z.string().trim().min(3).max(32).optional(),
  symbol: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/)
    .optional(),
  description: z.string().trim().max(160).optional(),
  imageUrl: z.string().trim().url().optional(),
  metadataUri: z.string().trim().url().optional(),
});

function getDefaultSymbol(username: string) {
  const clean = username.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (clean || "WORTH").slice(0, 10);
}

async function getCurrentUser(privyUserId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.privyUserId, privyUserId))
    .limit(1);

  return user;
}

export async function getMyCreatorToken(c: Context<AppEnv>) {
  const privyUserId = c.get("privyUserId");

  try {
    const user = await getCurrentUser(privyUserId);

    if (!user) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404
      );
    }

    return c.json(
      {
        success: true,
        token: user.token || null,
      },
      200
    );
  } catch (error) {
    console.error("Get creator token error:", error);

    return c.json(
      {
        success: false,
        message: "Failed to retrieve creator token",
      },
      500
    );
  }
}

export async function launchMyCreatorToken(c: Context<AppEnv>) {
  const privyUserId = c.get("privyUserId");
  const body = await c.req.json().catch(() => ({}));
  const parsedBody = creatorTokenLaunchSchema.safeParse(body);

  if (!parsedBody.success) {
    return c.json(
      {
        success: false,
        message:
          parsedBody.error.issues[0]?.message ?? "Invalid request body",
      },
      400
    );
  }

  try {
    const user = await getCurrentUser(privyUserId);

    if (!user) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404
      );
    }

    if (user.token) {
      return c.json(
        {
          success: true,
          message: "Creator token already launched",
          token: user.token,
        },
        200
      );
    }

    const name = parsedBody.data.name ?? user.username;
    const symbol =
      parsedBody.data.symbol?.toUpperCase() ?? getDefaultSymbol(user.username);
    const description =
      parsedBody.data.description ??
      (user.bio || `${user.username} creator token on Worth`);
    const imageUrl = parsedBody.data.imageUrl ?? user.avatar;

    const launchedToken = await launchCreatorTokenDevnet({
      name,
      symbol,
      description,
      imageUrl,
      metadataUri: parsedBody.data.metadataUri,
    });

    await db
      .update(users)
      .set({
        token: launchedToken.mintAddress,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return c.json(
      {
        success: true,
        message: "Creator token launched successfully",
        token: launchedToken.mintAddress,
        launch: launchedToken,
      },
      201
    );
  } catch (error) {
    console.error("Launch creator token error:", error);

    if (error instanceof Error) {
      if (error.message.includes("PINATA_JWT")) {
        return c.json(
          {
            success: false,
            message: "Pinata is not configured",
          },
          500
        );
      }

      if (error.message.includes("Token launch wallet not found")) {
        return c.json(
          {
            success: false,
            message: "Token launch wallet is not configured",
          },
          500
        );
      }
    }

    return c.json(
      {
        success: false,
        message: "Failed to launch creator token",
      },
      500
    );
  }
}
