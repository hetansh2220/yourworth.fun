import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "./users";

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

    rating: integer("rating")
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

    check(
      "rating_between_1_and_5",
      sql`${table.rating} >= 1 AND ${table.rating} <= 5`
    ),
  ]
);