import type { Context } from "hono";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { markets, marketSchema, socials, users } from "@/db/schema";
import type { AppEnv } from "@/types/app";
import { Keypair, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import { deriveDbcPoolAddress } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { CONFIG_ADDRESS } from "@/constants";
import { getTwitterUser } from "@/helpers/twitter.helper";
import { createTokenMetadataUri } from "@/helpers/pinata.helper";
import { createPool } from "@/helpers/meteora.helpers";
import connection from "@/lib/connection";
import dbc from "@/lib/dbc";
import signer from "@/lib/signer";

const marketsSchema = z
  .array(marketSchema)
  .min(1)
  .max(2)
  .refine(
    (items) =>
      new Set(items.map((item) => item.marketType)).size === items.length,
    { message: "Each market type can only appear once" },
  );

async function getMarketOwner(c: Context<AppEnv>) {
  const address = c.get("walletAddress");
  if (!address) return null;

  const [user] = await db
    .select({
      id: users.id,
      token: users.token,
    })
    .from(users)
    .where(eq(users.address, address))
    .limit(1);
  return user ?? null;
}

/** POST body: [{ marketType, paymentType, amount }]. */
export async function createMarket(c: Context<AppEnv>) {
  const parsed = marketsSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid market",
      },
      400,
    );
  }

  try {
    const user = await getMarketOwner(c);

    if (!user)
      return c.json(
        { success: false, message: "Authenticated profile is required" },
        401,
      );

    const [existingMarket] = await db
      .select({ id: markets.id })
      .from(markets)
      .where(eq(markets.userId, user.id))
      .limit(1);

    if (existingMarket || user.token) {
      return c.json({ success: false, message: "Market already exists" }, 409);
    }

    const [social] = await db
      .select({ username: socials.twitterUsername })
      .from(socials)
      .where(eq(socials.userId, user.id))
      .limit(1);
    if (!social?.username) {
      return c.json(
        { success: false, message: "Connect Twitter before creating a market" },
        400,
      );
    }

    const twitterBearerToken = c.req.header("X_BEARER_TOKEN")?.trim();
    if (!twitterBearerToken) {
      return c.json(
        { success: false, message: "X_BEARER_TOKEN header is required" },
        400,
      );
    }
    const profile = await getTwitterUser(social.username, twitterBearerToken);
    const name = `${profile.username}'s Time`;
    // SPL metadata symbols allow at most ten bytes.
    const symbol = profile.username.toUpperCase().slice(0, 10);
    if (!profile.profilePicture) {
      return c.json(
        { success: false, message: "Twitter profile picture is required" },
        400,
      );
    }
    const configAddress = new PublicKey(CONFIG_ADDRESS);
    const config = await dbc.state.getPoolConfig(configAddress);
    if (!config) throw new Error("Pool config not found");
    const { metadataUri } = await createTokenMetadataUri({
      name,
      symbol,
      description: profile.bio ?? name,
      imageUrl: profile.profilePicture,
    });

    const baseMint = Keypair.generate();
    const poolAddress = deriveDbcPoolAddress(
      config.quoteMint,
      baseMint.publicKey,
      configAddress,
    );

    const transaction = await createPool({
      name,
      symbol,
      uri: metadataUri,
      baseMint: baseMint.publicKey,
      payer: signer.publicKey,
      poolCreator: signer.publicKey,
    });
    transaction.feePayer = signer.publicKey;

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [signer, baseMint],
      {
        commitment: "confirmed",
      },
    );

    const [createdMarkets] = await db.batch([
      db
        .insert(markets)
        .values(
          parsed.data.map((item) => ({
            userId: user.id,
            marketType: item.marketType,
            paymentType: item.paymentType,
            amount: item.amount.toString(),
          })),
        )
        .returning(),
      db
        .update(users)
        .set({
          token: baseMint.publicKey.toBase58(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id)),
    ]);

    return c.json(
      { success: true, markets: createdMarkets, signature, metadataUri },
      201,
    );
  } catch (error) {
    console.error("Create market error:", error);
    return c.json({ success: false, message: "Failed to create market" }, 500);
  }
}

/** PATCH /me body: [{ marketType, paymentType, amount }]. */
export async function updateMarket(c: Context<AppEnv>) {
  const parsed = marketsSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid market",
      },
      400,
    );
  }

  try {
    const user = await getMarketOwner(c);
    if (!user)
      return c.json(
        { success: false, message: "Authenticated profile is required" },
        401,
      );

    const marketTypes = parsed.data.map((item) => item.marketType);
    const ownerMarkets = and(
      eq(markets.userId, user.id),
      inArray(markets.marketType, marketTypes),
    );
    const existingMarkets = await db
      .select({ id: markets.id })
      .from(markets)
      .where(ownerMarkets);
    if (existingMarkets.length !== parsed.data.length) {
      return c.json(
        { success: false, message: "One or more markets were not found" },
        404,
      );
    }

    // A single UPDATE applies the entire batch atomically.
    const updatedMarkets = await db
      .update(markets)
      .set({
        paymentType: sql`case ${markets.marketType} ${sql.join(
          parsed.data.map(
            (item) =>
              sql`when ${item.marketType} then ${item.paymentType}::payment_type`,
          ),
          sql` `,
        )} else ${markets.paymentType} end`,
        amount: sql`case ${markets.marketType} ${sql.join(
          parsed.data.map(
            (item) =>
              sql`when ${item.marketType} then ${item.amount.toString()}::numeric`,
          ),
          sql` `,
        )} else ${markets.amount} end`,
        updatedAt: new Date(),
      })
      .where(ownerMarkets)
      .returning();

    return c.json({ success: true, markets: updatedMarkets }, 200);
  } catch (error) {
    console.error("Update market error:", error);
    return c.json({ success: false, message: "Failed to update market" }, 500);
  }
}

/** Returns all markets belonging to the authenticated profile. */
export async function getMyMarket(c: Context<AppEnv>) {
  try {
    const user = await getMarketOwner(c);

    if (!user) {
      return c.json(
        { success: false, message: "Authenticated profile is required" },
        401,
      );
    }

    const userMarkets = await db
      .select()
      .from(markets)
      .where(eq(markets.userId, user.id))
      .orderBy(markets.marketType);

    return c.json({ success: true, markets: userMarkets }, 200);
  } catch (error) {
    console.error("Get my markets error:", error);
    return c.json(
      { success: false, message: "Failed to retrieve markets" },
      500,
    );
  }
}

/** Public GET /:id. */
export async function getMarket(c: Context<AppEnv>) {
  const parsedId = z.string().uuid().safeParse(c.req.param("id"));
  if (!parsedId.success) {
    return c.json({ success: false, message: "Invalid market id" }, 400);
  }

  try {
    const [market] = await db
      .select()
      .from(markets)
      .where(eq(markets.id, parsedId.data))
      .limit(1);

    if (!market)
      return c.json({ success: false, message: "Market not found" }, 404);
    return c.json({ success: true, market }, 200);
  } catch (error) {
    console.error("Get market error:", error);
    return c.json(
      { success: false, message: "Failed to retrieve market" },
      500,
    );
  }
}
