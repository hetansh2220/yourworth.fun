import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const chatTypeEnum = pgEnum("chat_type", [
  "DM",
  "GROUP",
]);

export const chats = pgTable("chats", {
  id: uuid("id")
    .defaultRandom()
    .primaryKey(),

  type: chatTypeEnum("type")
    .notNull(),

  image: text("image"),

  admin: uuid("admin")
    .notNull()
    .references(() => users.id, {
    }),

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


export const chatMembers = pgTable("chat_members",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, {}),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
      }),

    joinedAt: timestamp("joined_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    lastReadAt: timestamp("last_read_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    uniqueIndex("chat_member_unique").on(
      table.chatId,
      table.userId
    ),
  ]
);


export const messages = pgTable("messages",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, {
      }),

    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, {
      }),

    content: text("content")
      .notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_chat_created_at_idx").on(
      table.chatId,
      table.createdAt
    ),
  ]
);