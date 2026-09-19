import {
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";



export const paymentTypeEnum = pgEnum("payment_type", ["usdc", "token"]);

export const markets = pgTable("markets", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .unique(),

  dmPaymentType: paymentTypeEnum("dm_payment_type").notNull().default("usdc"),

  dmPrice: numeric("dm_price", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("0"),

  groupPrice: numeric("group_price", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("0"),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

const priceSchema = z.coerce
  .number()
  .min(0, "Price must be greater than or equal to 0");
const paymentTypeSchema = z.enum(["usdc", "token"]);

export const createMarketSchema = z.object({
  dmPaymentType: paymentTypeSchema,
  dmPrice: priceSchema,
  groupPrice: priceSchema,
});

export const updateMarketSchema = createMarketSchema.partial();
