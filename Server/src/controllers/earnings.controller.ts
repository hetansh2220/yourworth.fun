import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import type { Context } from "hono";
import { db } from "@/db";
import { dmRequests, earnings, users } from "@/db/schema";
import type { AppEnv } from "@/types/app";
import { z } from "zod";

const chartPeriodSchema = z.enum(["daily", "weekly", "monthly"]);
type ChartPeriod = z.infer<typeof chartPeriodSchema>;

/** GET /earnings. Returns the authenticated user's total earnings record count. */
export async function getEarnings(c: Context<AppEnv>) {
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.address, c.get("walletAddress")))
      .limit(1);

    if (!user) {
      return c.json({ success: false, message: "User profile not found" }, 404);
    }

    const [result] = await db
      .select({ count: count() })
      .from(earnings)
      .where(eq(earnings.userId, user.id));

    return c.json({ success: true, earnings: result?.count ?? 0 });
  } catch (error) {
    console.error("Get earnings count error:", error);
    return c.json(
      { success: false, message: "Failed to get earnings count" },
      500,
    );
  }
}

function startOfPeriod(date: Date, period: ChartPeriod): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  if (period === "weekly") {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  } else if (period === "monthly") {
    start.setUTCDate(1);
  }

  return start;
}

function bucketKey(date: Date, period: ChartPeriod): string {
  const start = startOfPeriod(date, period);
  if (period === "monthly") return start.toISOString().slice(0, 7);
  return start.toISOString().slice(0, 10);
}

function bucketLabel(date: Date, period: ChartPeriod): string {
  if (period === "daily") {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "UTC",
    }).format(date);
  }
  if (period === "weekly") {
    return `Week of ${new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date)}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** GET /earnings/chart?period=daily|weekly|monthly (defaults to daily). */
export async function getEarningsChart(c: Context<AppEnv>) {
  const parsedPeriod = chartPeriodSchema.safeParse(
    c.req.query("period") ?? "daily",
  );
  if (!parsedPeriod.success) {
    return c.json(
      { success: false, message: "period must be daily, weekly, or monthly" },
      400,
    );
  }

  try {
    const period = parsedPeriod.data;
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.address, c.get("walletAddress")))
      .limit(1);
    if (!user) {
      return c.json({ success: false, message: "User profile not found" }, 404);
    }

    const now = new Date();
    const currentBucket = startOfPeriod(now, period);
    const bucketCount = period === "daily" ? 7 : period === "weekly" ? 4 : 12;
    const bucketUnit =
      period === "daily" ? "day" : period === "weekly" ? "week" : "month";
    const start = new Date(currentBucket);

    if (period === "daily")
      start.setUTCDate(start.getUTCDate() - (bucketCount - 1));
    if (period === "weekly")
      start.setUTCDate(start.getUTCDate() - 7 * (bucketCount - 1));
    if (period === "monthly")
      start.setUTCMonth(start.getUTCMonth() - (bucketCount - 1));

    const bucketExpression = sql`date_trunc(${bucketUnit}, ${earnings.createdAt})`;
    const rows = await db
      .select({
        bucket: sql<Date>`${bucketExpression}`.as("bucket"),
        amount: sql<string>`coalesce(sum(${earnings.amount}), 0)::text`.as(
          "amount",
        ),
      })
      .from(earnings)
      .where(and(eq(earnings.userId, user.id), gte(earnings.createdAt, start)))
      .groupBy(bucketExpression)
      .orderBy(bucketExpression);

    const amountByBucket = new Map(
      rows.map((row) => [bucketKey(row.bucket, period), Number(row.amount)]),
    );
    const points = Array.from({ length: bucketCount }, (_, index) => {
      const date = new Date(currentBucket);
      if (period === "daily")
        date.setUTCDate(date.getUTCDate() - (bucketCount - 1 - index));
      if (period === "weekly")
        date.setUTCDate(date.getUTCDate() - 7 * (bucketCount - 1 - index));
      if (period === "monthly")
        date.setUTCMonth(date.getUTCMonth() - (bucketCount - 1 - index));

      const key = bucketKey(date, period);
      return {
        period: bucketLabel(date, period),
        amount: amountByBucket.get(key) ?? 0,
      };
    });

    return c.json({ success: true, points });
  } catch (error) {
    console.error("Get earnings chart error:", error);
    return c.json(
      { success: false, message: "Failed to get earnings chart" },
      500,
    );
  }
}

/** Returns completed DM spenders for the authenticated creator, highest spend first. */
export async function getSpenders(c: Context<AppEnv>) {
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.address, c.get("walletAddress")))
      .limit(1);
    if (!user) {
      return c.json({ success: false, message: "User profile not found" }, 404);
    }

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        avatar: users.avatar,
        verified: users.verified,
        amount: sql<string>`sum(${earnings.amount})::text`.as("amount"),
      })
      .from(dmRequests)
      .innerJoin(
        earnings,
        eq(earnings.transactionSignature, dmRequests.completeTxSignature),
      )
      .innerJoin(users, eq(users.id, dmRequests.userId))
      .where(
        and(
          eq(dmRequests.creatorId, user.id),
          eq(dmRequests.status, "COMPLETED"),
          eq(earnings.source, "DM"),
        ),
      )
      .groupBy(
        users.id,
        users.name,
        users.username,
        users.avatar,
        users.verified,
      )
      .orderBy(desc(sql`sum(${earnings.amount})`));

    return c.json({ success: true, spenders: rows });
  } catch (error) {
    console.error("Get DM spenders error:", error);
    return c.json(
      { success: false, message: "Failed to get DM spenders" },
      500,
    );
  }
}
