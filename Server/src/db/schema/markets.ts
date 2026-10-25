import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  unique,
  numeric,
} from "drizzle-orm/pg-core";
import { z } from "zod";

import { users } from "@/db/schema/users";

export const marketTypeEnum = pgEnum("market_type", ["DM", "GROUP"]);
export const paymentTypeEnum = pgEnum("payment_type", [
  "USDC",
  "CREATOR_TOKEN",
]);

export const markets = pgTable(
  "markets",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    marketType: marketTypeEnum("market_type").notNull(),

    paymentType: paymentTypeEnum("payment_type").notNull(),

    amount: numeric("amount", { precision: 20, scale: 6 }),

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
      table.marketType,
    ),
  ],
);

export const marketTypeSchema = z.enum(["DM", "GROUP"]);
export const paymentTypeSchema = z.enum(["USDC", "CREATOR_TOKEN"]);

export const marketSchema = z.object({
  marketType: marketTypeSchema,
  paymentType: paymentTypeSchema,
  amount: z.number().positive(),
}).refine(
  (data) => data.marketType !== "GROUP" || data.paymentType === "CREATOR_TOKEN",
  { message: "Private group markets require creator token payment", path: ["paymentType"] },
);
