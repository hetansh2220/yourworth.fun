import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { users } from "@/db/schema/users";

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referralCode: varchar("referral_code", { length: 32 }).notNull(),
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referredUserId: uuid("referred_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("referrals_referred_user_unique").on(table.referredUserId),
    index("referrals_referrer_idx").on(table.referrerId),
    index("referrals_code_idx").on(table.referralCode),
    check(
      "referrals_no_self_referral",
      sql`${table.referrerId} <> ${table.referredUserId}`,
    ),
  ],
);

export const createReferralSchema = createInsertSchema(referrals, {
  referralCode: z.string().trim().min(1).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  referrerId: z.string().uuid(),
  referredUserId: z.string().uuid(),
})
  .pick({ referralCode: true, referrerId: true, referredUserId: true })
  .refine((data) => data.referrerId !== data.referredUserId, {
    message: "You cannot refer yourself",
    path: ["referredUserId"],
  });

export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;
