import { createHash, randomBytes } from "node:crypto";
import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { socials, users } from "@/db/schema";
import type { AppEnv } from "@/types/app";

// Pending flows are process-local and expire after ten minutes.
const pending = new Map<
  string,
  { userId: string; verifier: string; expiresAt: number }
>();

function getConfig() {
  const { X_CLIENT_ID, X_CLIENT_SECRET, X_REDIRECT_URI } = process.env;
  if (!X_CLIENT_ID || !X_CLIENT_SECRET || !X_REDIRECT_URI) {
    throw new Error("Missing X OAuth configuration");
  }
  return {
    clientId: X_CLIENT_ID,
    clientSecret: X_CLIENT_SECRET,
    redirectUri: X_REDIRECT_URI,
  };
}

async function getOwner(c: Context<AppEnv>) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.address, c.get("walletAddress")))
    .limit(1);
  return user;
}

export async function connectTwitter(c: Context<AppEnv>) {
  c.header("Cache-Control", "no-store");
  try {
    const config = getConfig();
    const user = await getOwner(c);
    if (!user)
      return c.json(
        { success: false, message: "Create your user profile first" },
        404,
      );
    for (const [key, flow] of pending) {
      if (flow.expiresAt <= Date.now() || flow.userId === user.id)
        pending.delete(key);
    }
    if (pending.size >= 10000)
      return c.json({ success: false, message: "Please try again later" }, 503);
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const url = new URL("https://x.com/i/oauth2/authorize");
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: "tweet.read users.read",
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    pending.set(state, {
      userId: user.id,
      verifier,
      expiresAt: Date.now() + 600000,
    });
    return c.json({ success: true, url: url.toString() });
  } catch {
    return c.json(
      { success: false, message: "Failed to start Twitter connection" },
      500,
    );
  }
}

const callbackSchema = z.object({
  code: z.string().min(1).max(4096),
  state: z.string().min(1).max(500),
});
const tokenSchema = z.object({ access_token: z.string().min(1) });
const profileSchema = z.object({
  data: z.object({ id: z.string().min(1), username: z.string().min(1) }),
});

export async function twitterCallback(c: Context<AppEnv>) {
  c.header("Cache-Control", "no-store");
  const parsed = callbackSchema.safeParse({
    code: c.req.query("code"),
    state: c.req.query("state"),
  });
  if (!parsed.success)
    return c.text("Invalid Twitter callback", 400);
  try {
    const config = getConfig();
    const flow = pending.get(parsed.data.state);
    if (!flow || flow.expiresAt <= Date.now())
      return c.text("Invalid or expired Twitter connection", 400);
    pending.delete(parsed.data.state);
    const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        grant_type: "authorization_code",
        code: parsed.data.code,
        redirect_uri: config.redirectUri,
        code_verifier: flow.verifier,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!tokenResponse.ok)
      return c.json(
        {
          success: false,
          message: "Twitter authorization failed. Start again.",
        },
        502,
      );
    const token = tokenSchema.parse(await tokenResponse.json());
    const profileResponse = await fetch("https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!profileResponse.ok)
      return c.json(
        { success: false, message: "Failed to retrieve Twitter profile" },
        502,
      );
    const { data: profile } = profileSchema.parse(await profileResponse.json());
    const [saved] = await db
      .insert(socials)
      .values({ userId: flow.userId, twitterUsername: profile.username })
      .onConflictDoUpdate({
        target: socials.userId,
        set: { twitterUsername: profile.username, updatedAt: new Date() },
      })
      .returning();
    return c.redirect("http://localhost:3000/settings/profile?twitter=connected");
  } catch (error) {
    console.error("Twitter callback error:", error);
    return c.text("Failed to connect Twitter. Start again.", 500);
  }
}
