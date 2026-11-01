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

  username: varchar("username", {
    length: 20,
  })
    .notNull()
    .unique(),

  name: varchar("name", { length: 60 }).notNull(),

  verified: boolean("verified").notNull().default(false),

  address: text("address").notNull().unique(),

  avatar: text("avatar").notNull(),

  bio: text("bio").notNull().default(""),

  token: text("token").default(""),

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
    avatar: true,
    name: true,
    bio: true,
  })
  .extend({
    username: usernameSchema,
    avatar: z.string().url(),
    name: z.string().trim().min(1).max(60),
    bio: bioSchema,
  });

export const updateUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    name: true,
    avatar: true,
    bio: true,
  })
  .extend({
    username: usernameSchema.optional(),
    name: z.string().trim().min(1).max(60).optional(),
    avatar: z.string().url().optional(),
    bio: bioSchema.optional(),
  });
