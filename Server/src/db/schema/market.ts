import {
  boolean,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";

import { users } from "./user";

export const paymentTypeEnum = pgEnum("payment_type", ["usdc", "token"]);

export const markets = pgTable("markets", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, {
      onDelete: "cascade",
    }),

  dmPaymentType: paymentTypeEnum("dm_payment_type").notNull().default("usdc"),

  dmPriceUsdc: numeric("dm_price_usdc", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("0"),

  groupPaymentType: paymentTypeEnum("group_payment_type")
    .notNull()
    .default("usdc"),

  groupPriceUsdc: numeric("group_price_usdc", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("0"),

  isActive: boolean("is_active").notNull().default(true),

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
  groupPaymentType: paymentTypeSchema,
  groupPrice: priceSchema,
});

export const updateMarketSchema = createMarketSchema
  .extend({
    isActive: z.boolean(),
  })
  .partial();
