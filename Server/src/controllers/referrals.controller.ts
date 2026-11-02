import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, referralCodeSchema } from "@/db/schema";
import type { AppEnv } from "@/types/app";

export async function checkReferralCodeAvailability(c: Context<AppEnv>) {
  const parsed = referralCodeSchema.safeParse(c.req.query("referralCode"));
  if (!parsed.success) {
    return c.json({ success: false, available: false, message: "Invalid referral code" }, 400);
  }
  try {
    const [user] = await db.select({ id: users.id }).from(users)
      .where(eq(users.referralCode, parsed.data)).limit(1);
    return c.json({ success: true, available: !user });
  } catch (error) {
    console.error("Referral availability error:", error);
    return c.json({ success: false, message: "Failed to check referral code" }, 500);
  }
}

export async function updateReferralCode(c: Context<AppEnv>) {
  const parsed = z.object({ referralCode: referralCodeSchema })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ success: false, message: "Invalid referral code" }, 400);
  }
  try {
    const address = c.get("walletAddress");
    const [owner] = await db.select({ id: users.id }).from(users)
      .where(eq(users.address, address)).limit(1);
    if (!owner) return c.json({ success: false, message: "User not found" }, 404);
    const [taken] = await db.select({ id: users.id }).from(users)
      .where(eq(users.referralCode, parsed.data.referralCode)).limit(1);
    if (taken && taken.id !== owner.id) {
      return c.json({ success: false, message: "Referral code already taken" }, 409);
    }
    const [user] = await db.update(users)
      .set({ referralCode: parsed.data.referralCode, updatedAt: new Date() })
      .where(eq(users.id, owner.id)).returning({ referralCode: users.referralCode });
    return c.json({ success: true, referralCode: user!.referralCode });
  } catch (error) {
    let cause: unknown = error;
    while (typeof cause === "object" && cause !== null) {
      if ("code" in cause && cause.code === "23505") {
        return c.json({ success: false, message: "Referral code already taken" }, 409);
      }
      if (!("cause" in cause) || cause.cause === cause) break;
      cause = cause.cause;
    }
    console.error("Update referral code error:", error);
    return c.json({ success: false, message: "Failed to update referral code" }, 500);
  }
}
