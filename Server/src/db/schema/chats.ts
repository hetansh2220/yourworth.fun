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

export const chatTypeEnum = pgEnum("chat_type", ["DM", "GROUP"]);

export const chats = pgTable(
  "chats",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    type: chatTypeEnum("type").notNull(),

    admin: uuid("admin")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    creatorId: uuid("creator_id").references(() => users.id, {
      onDelete: "cascade",
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
  },
  (table) => [
    uniqueIndex("chats_creator_group_unique").on(table.creatorId, table.type),
    index("chats_creator_id_idx").on(table.creatorId),
  ],
);

export const chatMembers = pgTable(
  "chat_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, {
        onDelete: "cascade",
      }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
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
    uniqueIndex("chat_member_unique").on(table.chatId, table.userId),
    index("chat_members_user_id_idx").on(table.userId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, {
        onDelete: "cascade",
      }),

    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    content: text("content").notNull(),

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

    deletedAt: timestamp("deleted_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    index("messages_chat_created_at_idx").on(table.chatId, table.createdAt),
  ],
);
