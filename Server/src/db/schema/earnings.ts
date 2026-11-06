import {
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { users } from "@/db/schema/users";

export const earningSourceEnum = pgEnum("earning_source", ["DM", "GROUP"]);

/** A settled incoming payment, used for earnings history and chart aggregation. */
export const earnings = pgTable(
  "earnings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** User who received the earning. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    source: earningSourceEnum("source").notNull(),

    /** Settled earning amount in USD. */
    amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),

    /** Settlement transaction signature; unique to prevent duplicate ledger rows. */
    transactionSignature: text("transaction_signature").notNull(),

    /** Used for history ordering and chart buckets. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("earnings_transaction_signature_unique").on(
      table.transactionSignature,
    ),
    index("earnings_user_created_at_idx").on(table.userId, table.createdAt),
    index("earnings_user_source_created_at_idx").on(
      table.userId,
      table.source,
      table.createdAt,
    ),
  ],
);

export const createEarningSchema = createInsertSchema(earnings)
  .pick({
    userId: true,
    source: true,
    amount: true,
    transactionSignature: true,
    createdAt: true,
  })
  .extend({
    amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
    transactionSignature: z.string().trim().min(32),
    createdAt: z.coerce.date().optional(),
  });
