import type { Context } from "hono";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { marketSchema, markets, marketTypeSchema, users } from "../db/schema";
import type { AppEnv } from "../types/app";

function getErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "";
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

  return cursorDate && !Number.isNaN(cursorDate.getTime()) ? cursorDate : null;
}

function getMarketTypeQuery(c: Context<AppEnv>) {
  const marketType = c.req.query("marketType");

  if (!marketType) {
    return null;
  }

  return marketTypeSchema.safeParse(marketType);
}

const marketWithUserFields = {
  id: markets.id,
  marketType: markets.marketType,
  paymentType: markets.paymentType,
  amount: markets.amount,
  createdAt: markets.createdAt,
  updatedAt: markets.updatedAt,
  user: {
    id: users.id,
    username: users.username,
    name: users.name,
    avatar: users.avatar,
    bio: users.bio,
    token: users.token,
  },
};

async function getCurrentUser(walletAddress: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.address, walletAddress))
    .limit(1);

  return user;
}

async function getMarketByUserAndType(
  userId: string,
  marketType: "DM" | "GROUP",
) {
  const [market] = await db
    .select(marketWithUserFields)
    .from(markets)
    .innerJoin(users, eq(markets.userId, users.id))
    .where(and(eq(markets.userId, userId), eq(markets.marketType, marketType)))
    .limit(1);

  return market;
}

async function getMarketsByUserId(userId: string) {
  return db
    .select(marketWithUserFields)
    .from(markets)
    .innerJoin(users, eq(markets.userId, users.id))
    .where(eq(markets.userId, userId))
    .orderBy(desc(markets.createdAt));
}

export async function createMarket(c: Context<AppEnv>) {
  const walletAddress = c.get("walletAddress");
  const body = await c.req.json().catch(() => null);
  const parsedBody = marketSchema.safeParse(body);

  if (!parsedBody.success) {
    return c.json(
      {
        success: false,
        message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
      },
      400,
    );
  }

  const paymentType = parsedBody.data.paymentType;

  try {
    const user = await getCurrentUser(walletAddress);

    if (!user) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404,
      );
    }

    const existingMarket = await getMarketByUserAndType(
      user.id,
      parsedBody.data.marketType,
    );

    if (existingMarket) {
      const [updatedMarket] = await db
        .update(markets)
        .set({
          paymentType,
          amount: parsedBody.data.amount.toString(),
          updatedAt: new Date(),
        })
        .where(eq(markets.id, existingMarket.id))
        .returning({ id: markets.id });

      return c.json(
        {
          success: true,
          message: "Market updated successfully",
          market: updatedMarket
            ? await getMarketByUserAndType(user.id, parsedBody.data.marketType)
            : existingMarket,
        },
        200,
      );
    }

    await db.insert(markets).values({
      userId: user.id,
      marketType: parsedBody.data.marketType,
      paymentType,
      amount: parsedBody.data.amount.toString(),
    });

    const market = await getMarketByUserAndType(
      user.id,
      parsedBody.data.marketType,
    );

    return c.json(
      {
        success: true,
        message: "Market created successfully",
        market,
      },
      201,
    );
  } catch (error) {
    console.error("Create market error:", error);

    if (getErrorCode(error) === "23505") {
      return c.json(
        {
          success: false,
          message: "Market already exists",
        },
        409,
      );
    }

    return c.json(
      {
        success: false,
        message: "Failed to create market",
      },
      500,
    );
  }
}

export async function getMarkets(c: Context<AppEnv>) {
  const limit = getLimit(c);
  const cursor = getCursor(c);
  const parsedMarketType = getMarketTypeQuery(c);

  if (parsedMarketType && !parsedMarketType.success) {
    return c.json(
      {
        success: false,
        message: "Market type is invalid",
      },
      400,
    );
  }

  try {
    const marketType = parsedMarketType?.data;
    const marketList = cursor
      ? await db
          .select(marketWithUserFields)
          .from(markets)
          .innerJoin(users, eq(markets.userId, users.id))
          .where(
            marketType
              ? and(
                  lt(markets.createdAt, cursor),
                  eq(markets.marketType, marketType),
                )
              : lt(markets.createdAt, cursor),
          )
          .orderBy(desc(markets.createdAt))
          .limit(limit + 1)
      : marketType
        ? await db
            .select(marketWithUserFields)
            .from(markets)
            .innerJoin(users, eq(markets.userId, users.id))
            .where(eq(markets.marketType, marketType))
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
      200,
    );
  } catch (error) {
    console.error("Get markets error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve markets",
      },
      500,
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
      400,
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
        404,
      );
    }

    return c.json(
      {
        success: true,
        market,
      },
      200,
    );
  } catch (error) {
    console.error("Get market error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve market",
      },
      500,
    );
  }
}

export async function getMyMarket(c: Context<AppEnv>) {
  const walletAddress = c.get("walletAddress");
  const parsedMarketType = getMarketTypeQuery(c);

  if (parsedMarketType && !parsedMarketType.success) {
    return c.json(
      {
        success: false,
        message: "Market type is invalid",
      },
      400,
    );
  }

  try {
    const user = await getCurrentUser(walletAddress);

    if (!user) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404,
      );
    }

    if (parsedMarketType?.data) {
      const market = await getMarketByUserAndType(
        user.id,
        parsedMarketType.data,
      );

      if (!market) {
        return c.json(
          {
            success: false,
            message: "Market not found",
          },
          404,
        );
      }

      return c.json(
        {
          success: true,
          market,
        },
        200,
      );
    }

    const marketList = await getMarketsByUserId(user.id);

    return c.json(
      {
        success: true,
        markets: marketList,
      },
      200,
    );
  } catch (error) {
    console.error("Get my market error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to retrieve market",
      },
      500,
    );
  }
}

export async function updateMarket(c: Context<AppEnv>) {
  const walletAddress = c.get("walletAddress");
  const body = await c.req.json().catch(() => null);
  const parsedBody = marketSchema.safeParse(body);

  if (!parsedBody.success) {
    return c.json(
      {
        success: false,
        message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
      },
      400,
    );
  }

  const paymentType = parsedBody.data.paymentType;

  try {
    const user = await getCurrentUser(walletAddress);

    if (!user) {
      return c.json(
        {
          success: false,
          message: "Create your user profile first",
        },
        404,
      );
    }

    const [updatedMarket] = await db
      .update(markets)
      .set({
        paymentType,
        amount: parsedBody.data.amount.toString(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(markets.userId, user.id),
          eq(markets.marketType, parsedBody.data.marketType),
        ),
      )
      .returning({ id: markets.id });

    if (!updatedMarket) {
      return c.json(
        {
          success: false,
          message: "Market not found",
        },
        404,
      );
    }

    const market = await getMarketByUserAndType(
      user.id,
      parsedBody.data.marketType,
    );

    return c.json(
      {
        success: true,
        message: "Market updated successfully",
        market,
      },
      200,
    );
  } catch (error) {
    console.error("Update market error:", error);
    return c.json(
      {
        success: false,
        message: "Failed to update market",
      },
      500,
    );
  }
}
