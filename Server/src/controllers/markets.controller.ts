import type { Context } from "hono";
import { desc, eq, lt } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import {
  createMarketSchema,
  markets,
  updateMarketSchema,
  users,
} from "../db/schema";
import type { AppEnv } from "../types/app";

function getErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "";
}

function toAmount(value: number) {
  return value.toFixed(2);
}

function getLimit(c: Context<AppEnv>) {
  const parsedLimit = Number(c.req.query("limit") ?? "20");

  return Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 50)
    : 20;
}

function getCursor(c: Context<AppEnv>) {
  const cursor = c.req.query("cursor");
  const cursorDate = cursor ? new Date(cursor) : null;

  return cursorDate && !Number.isNaN(cursorDate.getTime())
    ? cursorDate
    : null;
}

const marketWithUserFields = {
  id: markets.id,
  dmPaymentType: markets.dmPaymentType,
  dmPrice: markets.dmPrice,
  groupPrice: markets.groupPrice,
  createdAt: markets.createdAt,
  updatedAt: markets.updatedAt,
  user: {
    id: users.id,
    username: users.username,
    avatar: users.avatar,
  },
};

async function getCurrentUser(privyUserId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.privyUserId, privyUserId))
    .limit(1);

  return user;
}

async function getMarketByUserId(userId: string) {
  const [market] = await db
    .select(marketWithUserFields)
    .from(markets)
    .innerJoin(users, eq(markets.userId, users.id))
    .where(eq(markets.userId, userId))
    .limit(1);

  return market;
}

export async function createMarket(c: Context<AppEnv>) {
  const privyUserId = c.get("privyUserId");
  const body = await c.req.json().catch(() => null);
  const parsedBody = createMarketSchema.safeParse(body);

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

    const existingMarket = await getMarketByUserId(user.id);

    if (existingMarket) {
      return c.json(
        {
          success: true,
          message: "Market already exists",
          market: existingMarket,
        },
        200
      );
    }

    await db.insert(markets).values({
      userId: user.id,
      dmPaymentType: parsedBody.data.dmPaymentType,
      dmPrice: toAmount(parsedBody.data.dmPrice),
      groupPrice: toAmount(parsedBody.data.groupPrice),
    });

    const market = await getMarketByUserId(user.id);

    return c.json(
      {
        success: true,
        message: "Market created successfully",
        market,
      },
      201
    );
  } catch (error) {
    console.error("Create market error:", error);

    if (getErrorCode(error) === "23505") {
      return c.json(
        {
          success: false,
          message: "Market already exists",
        },
        409
      );
    }

    return c.json(
      {
        success: false,
        message: "Failed to create market",
      },
      500
    );
  }
}

export async function getMarkets(c: Context<AppEnv>) {
  const limit = getLimit(c);
  const cursor = getCursor(c);

  try {
    const marketList = cursor
      ? await db
          .select(marketWithUserFields)
          .from(markets)
          .innerJoin(users, eq(markets.userId, users.id))
          .where(lt(markets.createdAt, cursor))
          .orderBy(desc(markets.createdAt))
          .limit(limit + 1)
      : await db
          .select(marketWithUserFields)
          .from(markets)
          .innerJoin(users, eq(markets.userId, users.id))
          .orderBy(desc(markets.createdAt))
          .limit(limit + 1);

    const visibleMarkets = marketList.slice(0, limit);
    const lastMarket = visibleMarkets.at(-1);
    const nextCursor =
      marketList.length > limit && lastMarket
        ? lastMarket.createdAt.toISOString()
        : null;

    return c.json(
      {
        success: true,
        markets: visibleMarkets,
        nextCursor,
      },
      200
    );
  } catch (error) {
    console.error("Get markets error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve markets",
      },
      500
    );
  }
}

export async function getMarket(c: Context<AppEnv>) {
  const parsedId = z.string().uuid().safeParse(c.req.param("id"));

  if (!parsedId.success) {
    return c.json(
      {
        success: false,
        message: "Market id is invalid",
      },
      400
    );
  }

  try {
    const [market] = await db
      .select(marketWithUserFields)
      .from(markets)
      .innerJoin(users, eq(markets.userId, users.id))
      .where(eq(markets.id, parsedId.data))
      .limit(1);

    if (!market) {
      return c.json(
        {
          success: false,
          message: "Market not found",
        },
        404
      );
    }

    return c.json(
      {
        success: true,
        market,
      },
      200
    );
  } catch (error) {
    console.error("Get market error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve market",
      },
      500
    );
  }
}

export async function getMyMarket(c: Context<AppEnv>) {
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

    const market = await getMarketByUserId(user.id);

    if (!market) {
      return c.json(
        {
          success: false,
          message: "Market not found",
        },
        404
      );
    }

    return c.json(
      {
        success: true,
        market,
      },
      200
    );
  } catch (error) {
    console.error("Get my market error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve market",
      },
      500
    );
  }
}

export async function updateMarket(c: Context<AppEnv>) {
  const privyUserId = c.get("privyUserId");
  const body = await c.req.json().catch(() => null);
  const parsedBody = updateMarketSchema.safeParse(body);

  if (!parsedBody.success) {
    return c.json(
      {
        success: false,
        message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
      },
      400
    );
  }

  if (Object.keys(parsedBody.data).length === 0) {
    return c.json(
      {
        success: false,
        message: "Nothing to update",
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

    const updateValues: Partial<typeof markets.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (parsedBody.data.dmPaymentType) {
      updateValues.dmPaymentType = parsedBody.data.dmPaymentType;
    }

    if (parsedBody.data.dmPrice !== undefined) {
      updateValues.dmPrice = toAmount(parsedBody.data.dmPrice);
    }

    if (parsedBody.data.groupPrice !== undefined) {
      updateValues.groupPrice = toAmount(parsedBody.data.groupPrice);
    }

    const [updatedMarket] = await db
      .update(markets)
      .set(updateValues)
      .where(eq(markets.userId, user.id))
      .returning({ id: markets.id });

    if (!updatedMarket) {
      return c.json(
        {
          success: false,
          message: "Market not found",
        },
        404
      );
    }

    const market = await getMarketByUserId(user.id);

    return c.json(
      {
        success: true,
        message: "Market updated successfully",
        market,
      },
      200
    );
  } catch (error) {
    console.error("Update market error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to update market",
      },
      500
    );
  }
}
