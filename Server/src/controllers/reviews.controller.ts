import type { Context } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { reviews, users } from "@/db/schema";
import type { AppEnv } from "@/types/app";

const idSchema = z.string().uuid();
const reviewFields = {
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).nullable().optional(),
};

const createReviewSchema = z.object({
  reviewedUserId: idSchema,
  ...reviewFields,
});
const updateReviewSchema = z
  .object(reviewFields)
  .partial()
  .refine(
    (value) => value.rating !== undefined || value.comment !== undefined,
    { message: "Provide a rating or comment to update" },
  );
const listReviewsSchema = z.object({
  reviewedUserId: idSchema,
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .default(0),
});

async function getReviewer(c: Context<AppEnv>) {
  const address = c.get("walletAddress");
  if (!address) return null;
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.address, address))
    .limit(1);
  return user ?? null;
}

/** Authenticated POST body: { reviewedUserId, rating, comment? }. */
export async function createReview(c: Context<AppEnv>) {
  const parsed = createReviewSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success)
    return c.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid review",
      },
      400,
    );

  try {
    const reviewer = await getReviewer(c);
    if (!reviewer)
      return c.json(
        { success: false, message: "Authenticated profile is required" },
        401,
      );
    if (reviewer.id === parsed.data.reviewedUserId)
      return c.json(
        { success: false, message: "You cannot review yourself" },
        400,
      );
    const [target] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, parsed.data.reviewedUserId))
      .limit(1);
    if (!target)
      return c.json({ success: false, message: "User not found" }, 404);

    const [review] = await db
      .insert(reviews)
      .values({
        reviewerId: reviewer.id,
        reviewedUserId: parsed.data.reviewedUserId,
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
      })
      .onConflictDoNothing({
        target: [reviews.reviewerId, reviews.reviewedUserId],
      })
      .returning();
    if (!review)
      return c.json(
        { success: false, message: "You have already reviewed this user" },
        409,
      );
    return c.json({ success: true, review }, 201);
  } catch (error) {
    console.error("Create review error:", error);
    return c.json({ success: false, message: "Failed to create review" }, 500);
  }
}

/** Public GET query: reviewedUserId, limit (default 20), offset (default 0). */
export async function getReviews(c: Context<AppEnv>) {
  const parsed = listReviewsSchema.safeParse(c.req.query());
  if (!parsed.success)
    return c.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid query",
      },
      400,
    );

  try {
    const { reviewedUserId, limit, offset } = parsed.data;
    const rows = await db
      .select({
        id: reviews.id,
        reviewedUserId: reviews.reviewedUserId,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        reviewer: {
          id: users.id,
          name: users.name,
          username: users.username,
          avatar: users.avatar,
        },
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.reviewerId, users.id))
      .where(eq(reviews.reviewedUserId, reviewedUserId))
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(limit + 1)
      .offset(offset);
    return c.json(
      {
        success: true,
        reviews: rows.slice(0, limit),
        nextOffset: rows.length > limit ? offset + limit : null,
      },
      200,
    );
  } catch (error) {
    console.error("Get reviews error:", error);
    return c.json(
      { success: false, message: "Failed to retrieve reviews" },
      500,
    );
  }
}

/** Authenticated PATCH /:id body: { rating?, comment? }. */
export async function updateReview(c: Context<AppEnv>) {
  const id = idSchema.safeParse(c.req.param("id"));
  const parsed = updateReviewSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!id.success)
    return c.json({ success: false, message: "Invalid review id" }, 400);
  if (!parsed.success)
    return c.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid review",
      },
      400,
    );

  try {
    const reviewer = await getReviewer(c);
    if (!reviewer)
      return c.json(
        { success: false, message: "Authenticated profile is required" },
        401,
      );
    const [review] = await db
      .update(reviews)
      .set({
        ...(parsed.data.rating !== undefined
          ? { rating: parsed.data.rating }
          : {}),
        ...(parsed.data.comment !== undefined
          ? { comment: parsed.data.comment || null }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(reviews.id, id.data), eq(reviews.reviewerId, reviewer.id)))
      .returning();
    if (!review)
      return c.json({ success: false, message: "Review not found" }, 404);
    return c.json({ success: true, review }, 200);
  } catch (error) {
    console.error("Update review error:", error);
    return c.json({ success: false, message: "Failed to update review" }, 500);
  }
}
