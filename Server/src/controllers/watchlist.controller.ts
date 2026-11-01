import type { Context } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { createWatchlistSchema, users, watchlist } from "@/db/schema";
import type { AppEnv } from "@/types/app";

// Only trust identity supplied by authentication middleware.
async function getOwner(c: Context<AppEnv>) {
  const address = c.get("walletAddress");
  if (!address) return null;
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.address, address))
    .limit(1);
  return user ?? null;
}

/** POST body: { watchedUserId: UUID }. Requires authenticated user context. */
export async function addToWatchlist(c: Context<AppEnv>) {
  const parsed = createWatchlistSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      { success: false, message: "A valid watchedUserId is required" },
      400,
    );
  }

  try {
    const owner = await getOwner(c);
    if (!owner)
      return c.json(
        { success: false, message: "Authenticated profile is required" },
        401,
      );
    const { watchedUserId } = parsed.data;
    const [target] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, watchedUserId))
      .limit(1);
    if (!target)
      return c.json({ success: false, message: "User not found" }, 404);

    const [entry] = await db
      .insert(watchlist)
      .values({ userId: owner.id, watchedUserId })
      .onConflictDoNothing({
        target: [watchlist.userId, watchlist.watchedUserId],
      })
      .returning();

    if (!entry)
      return c.json(
        { success: true, message: "User is already in your watchlist" },
        200,
      );
    return c.json({ success: true, message: "Added to watchlist", entry }, 201);
  } catch (error) {
    console.error("Add to watchlist error:", error);
    return c.json(
      { success: false, message: "Failed to add to watchlist" },
      500,
    );
  }
}

/** DELETE /:watchedUserId. Deletes only the authenticated user's entry. */
export async function removeFromWatchlist(c: Context<AppEnv>) {
  const parsed = createWatchlistSchema.safeParse({
    watchedUserId: c.req.param("watchedUserId"),
  });
  if (!parsed.success) {
    return c.json(
      { success: false, message: "A valid watchedUserId is required" },
      400,
    );
  }

  try {
    const owner = await getOwner(c);
    if (!owner)
      return c.json(
        { success: false, message: "Authenticated profile is required" },
        401,
      );
    await db
      .delete(watchlist)
      .where(
        and(
          eq(watchlist.userId, owner.id),
          eq(watchlist.watchedUserId, parsed.data.watchedUserId),
        ),
      );
    return c.json({ success: true, message: "Removed from watchlist" }, 200);
  } catch (error) {
    console.error("Remove from watchlist error:", error);
    return c.json(
      { success: false, message: "Failed to remove from watchlist" },
      500,
    );
  }
}

/** Returns the authenticated user's watchlist, newest additions first. */
export async function getWatchlist(c: Context<AppEnv>) {
  try {
    const owner = await getOwner(c);
    if (!owner) {
      return c.json(
        { success: false, message: "Authenticated profile is required" },
        401,
      );
    }

    const entries = await db
      .select({
        id: watchlist.id,
        watchedUserId: watchlist.watchedUserId,
        createdAt: watchlist.createdAt,
        user: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatar: users.avatar,
          bio: users.bio,
          verified: users.verified,
          token: users.token,
        },
      })
      .from(watchlist)
      .innerJoin(users, eq(watchlist.watchedUserId, users.id))
      .where(eq(watchlist.userId, owner.id))
      .orderBy(desc(watchlist.createdAt), desc(watchlist.id));

    return c.json({ success: true, watchlist: entries }, 200);
  } catch (error) {
    console.error("Get watchlist error:", error);
    return c.json(
      { success: false, message: "Failed to retrieve watchlist" },
      500,
    );
  }
}
