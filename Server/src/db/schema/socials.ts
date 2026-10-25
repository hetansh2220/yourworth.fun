import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { users } from "@/db/schema/users";

export const socials = pgTable("socials", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  twitterUsername: text("twitter_username"),
  instagramUsername: text("instagram_username"),
  youtubeUsername: text("youtube_username"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// User identity is supplied by authentication middleware.
export const createSocialsSchema = createInsertSchema(socials).pick({
  twitterUsername: true,
  instagramUsername: true,
  youtubeUsername: true,
});

export const updateSocialsSchema = createSocialsSchema.partial();

export type Socials = typeof socials.$inferSelect;
export type NewSocials = typeof socials.$inferInsert;
