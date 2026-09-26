import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { z } from "zod";

import { users } from "./users";

export const marketTypeEnum = pgEnum("market_type", ["dm", "group"]);

export const paymentTypeEnum = pgEnum("payment_type", ["usdc", "token"]);

export const markets = pgTable(
  "markets",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    marketType: marketTypeEnum("market_type")
      .notNull(),

    paymentType: paymentTypeEnum("payment_type")
      .notNull(),

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
  },
  (table) => [
    unique("markets_user_id_market_type_unique").on(
      table.userId,
      table.marketType
    ),
  ]
);

export const marketTypeSchema = z.enum(["dm", "group"]);
export const paymentTypeSchema = z.enum(["usdc", "token"]);

export const marketSchema = z.object({
  marketType: marketTypeSchema,
  paymentType: paymentTypeSchema,
});

