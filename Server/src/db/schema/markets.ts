import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  unique,
  numeric,
} from "drizzle-orm/pg-core";
import { z } from "zod";

import { users } from "./users";

export const marketTypeEnum = pgEnum("market_type", ["dm", "group"]);

export const paymentTypeEnum = pgEnum("payment_type", ["usdc", "token"]);
export const accessRuleEnum = pgEnum("access_rule", ["fixed", "holders", "minutes"]);

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

    accessRule: accessRuleEnum("access_rule").notNull().default("fixed"),

    priceAmount: numeric("price_amount", { precision: 20, scale: 6 }),

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
export const accessRuleSchema = z.enum(["fixed", "holders", "minutes"]);

export const marketSchema = z
  .object({
    marketType: marketTypeSchema,
    paymentType: paymentTypeSchema,
    // Keep this optional for older clients; the controller derives the safe
    // default from the market type before inserting/updating.
    accessRule: accessRuleSchema.optional(),
    priceAmount: z.number().positive().optional(),
  })
  .refine(
    (data) => data.marketType !== "group" || data.paymentType === "token",
    {
      message: "Private group markets require creator token payment",
      path: ["paymentType"],
    }
  )
  .refine((data) => data.accessRule === undefined || data.accessRule === "holders" || data.priceAmount !== undefined, {
    message: "A price amount is required",
    path: ["priceAmount"],
  })
  .refine((data) => data.marketType !== "group" || data.accessRule === undefined || data.accessRule !== "fixed", {
    message: "Private community access must use holders or minutes",
    path: ["accessRule"],
  })
  .refine((data) => data.marketType !== "dm" || data.accessRule === undefined || data.accessRule === "fixed", {
    message: "Direct messages must use fixed pricing",
    path: ["accessRule"],
  });
