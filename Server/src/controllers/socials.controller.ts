import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  socials,
  users,
  createSocialsSchema,
  updateSocialsSchema,
} from "@/db/schema";
import type { AppEnv } from "@/types/app";

async function getOwner(c: Context<AppEnv>) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.address, c.get("walletAddress")))
    .limit(1);
  return user;
}

export async function createSocials(c: Context<AppEnv>) {
  const parsed = createSocialsSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success || !Object.keys(parsed.data).length) {
    return c.json(
      { success: false, message: "Provide valid social usernames" },
      400,
    );
  }
  try {
    const user = await getOwner(c);
    if (!user)
      return c.json(
        { success: false, message: "Create your user profile first" },
        404,
      );
    const [created] = await db
      .insert(socials)
      .values({ ...parsed.data, userId: user.id })
      .onConflictDoNothing({ target: socials.userId })
      .returning();
    if (!created)
      return c.json({ success: false, message: "Socials already exist" }, 409);
    return c.json({ success: true, socials: created }, 201);
  } catch (error) {
    console.error("Create socials error:", error);
    return c.json({ success: false, message: "Failed to create socials" }, 500);
  }
}

export async function updateSocials(c: Context<AppEnv>) {
  const parsed = updateSocialsSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success || !Object.keys(parsed.data).length) {
    return c.json(
      { success: false, message: "Provide valid social usernames" },
      400,
    );
  }
  try {
    const user = await getOwner(c);
    if (!user)
      return c.json(
        { success: false, message: "Create your user profile first" },
        404,
      );
    const [updated] = await db
      .update(socials)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(socials.userId, user.id))
      .returning();
    if (!updated)
      return c.json({ success: false, message: "Socials not found" }, 404);
    return c.json({ success: true, socials: updated });
  } catch (error) {
    console.error("Update socials error:", error);
    return c.json({ success: false, message: "Failed to update socials" }, 500);
  }
}

export async function getMySocials(c: Context<AppEnv>) {
  try {
    const user = await getOwner(c);
    if (!user)
      return c.json(
        { success: false, message: "Create your user profile first" },
        404,
      );
    const [row] = await db
      .select()
      .from(socials)
      .where(eq(socials.userId, user.id))
      .limit(1);
    return c.json({ success: true, socials: row ?? null });
  } catch (error) {
    console.error("Get my socials error:", error);
    return c.json(
      { success: false, message: "Failed to retrieve socials" },
      500,
    );
  }
}

export async function getSocials(c: Context<AppEnv>) {
  const parsed = z.string().uuid().safeParse(c.req.param("userId"));
  if (!parsed.success)
    return c.json({ success: false, message: "Invalid user id" }, 400);
  try {
    const [row] = await db
      .select()
      .from(socials)
      .where(eq(socials.userId, parsed.data))
      .limit(1);
    return c.json({ success: true, socials: row ?? null });
  } catch (error) {
    console.error("Get socials error:", error);
    return c.json(
      { success: false, message: "Failed to retrieve socials" },
      500,
    );
  }
}
