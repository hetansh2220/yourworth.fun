import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { users } from "@/db/schema/users";

export const watchlist = pgTable(
  "watchlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    watchedUserId: uuid("watched_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("watchlist_user_watched_user_unique").on(
      table.userId,
      table.watchedUserId,
    ),
    index("watchlist_watched_user_idx").on(table.watchedUserId),
  ],
);

// The owner is supplied by the authenticated session, not the request body.
export const createWatchlistSchema = createInsertSchema(watchlist).pick({
  watchedUserId: true,
});

export type WatchlistEntry = typeof watchlist.$inferSelect;
export type NewWatchlistEntry = typeof watchlist.$inferInsert;
