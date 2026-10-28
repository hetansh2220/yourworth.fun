import {
  pgTable,
  uuid,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "@/db/schema/users";

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",  
      }),

    reviewedUserId: uuid("reviewed_user_id")
      .notNull()
      .references(() => users.id),

    rating: numeric("rating", { precision: 2, scale: 1, mode: "number" })
      .notNull(),

    comment: text("comment"),

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
    uniqueIndex("reviewer_reviewed_user_unique").on(
      table.reviewerId,
      table.reviewedUserId
    ),

    check("rating_half_star_increment", sql`mod(${table.rating}, 0.5) = 0`),

    check(
      "rating_between_1_and_5",
      sql`${table.rating} >= 1 AND ${table.rating} <= 5`
    ),
  ]
);