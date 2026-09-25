import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  privyUserId: text("privy_user_id").notNull().unique(),

  username: varchar("username", {
    length: 20,
  })
    .notNull()
    .unique(),

  walletAddress: text("wallet_address").notNull().unique(),

  avatar: text("avatar").notNull(),

  bio: text("bio").notNull().default(""),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/);

const bioSchema = z.string().trim().min(1).max(160);

export const createUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    bio: true,
  })
  .extend({
    username: usernameSchema,
    bio: bioSchema,
  });

export const updateUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    avatar: true,
    bio: true,
  })
  .extend({
    username: usernameSchema.optional(),
    avatar: z.string().url().optional(),
    bio: bioSchema.optional(),
  });
