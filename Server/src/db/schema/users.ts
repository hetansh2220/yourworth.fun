import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
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

  displayName: varchar("display_name", { length: 60 }).notNull(),

  xConnected: boolean("x_connected"),

  xUserId: text("x_user_id"),

  xUsername: varchar("x_username", { length: 100 }),

  walletAddress: text("wallet_address").notNull().unique(),

  avatar: text("avatar").notNull(),

  bio: text("bio").notNull().default(""),

  token: text("token").default(""),

  poolAddress: text("pool_address"),

  configAddress: text("config_address"),

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
    displayName: true,
    avatar: true,
    bio: true,
  })
  .extend({
    username: usernameSchema,
    displayName: z.string().trim().min(1).max(60),
    avatar: z.string().url(),
    bio: bioSchema,
  });

export const updateUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    displayName: true,
    avatar: true,
    bio: true,
  })
  .extend({
    username: usernameSchema.optional(),
    displayName: z.string().trim().min(1).max(60).optional(),
    avatar: z.string().url().optional(),
    bio: bioSchema.optional(),
  });
