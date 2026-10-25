import {
  bigint,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { chats, messages } from "@/db/schema/chats";
import { users } from "@/db/schema/users";

export const dmRequestStatusEnum = pgEnum("dm_request_status", [
  "PENDING",
  "COMPLETED",
  "REFUNDED",
  "FAILED",
  "EXPIRED",
]);

export const dmRequests = pgTable(
  "dm_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    requestId: bigint("request_id", {
      mode: "number",
    }).notNull(),

    requestPda: text("request_pda").notNull(),

    escrowTokenAccount: text("escrow_token_account").notNull(),

    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, {
        onDelete: "cascade",
      }),

    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, {
        onDelete: "cascade",
      }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    paymentMint: text("payment_mint").notNull(),

    amount: numeric("amount", {
      precision: 78,
      scale: 0,
    }).notNull(),

    createTxSignature: text("create_tx_signature").notNull(),

    completeTxSignature: text("complete_tx_signature"),

    refundTxSignature: text("refund_tx_signature"),

    status: dmRequestStatusEnum("status").default("PENDING").notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    completedAt: timestamp("completed_at", {
      withTimezone: true,
    }),

    refundedAt: timestamp("refunded_at", {
      withTimezone: true,
    }),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("dm_requests_request_id_unique").on(table.requestId),
    unique("dm_requests_request_pda_unique").on(table.requestPda),
    unique("dm_requests_escrow_token_account_unique").on(
      table.escrowTokenAccount,
    ),
    unique("dm_requests_message_id_unique").on(table.messageId),
    index("dm_requests_chat_id_idx").on(table.chatId),
    index("dm_requests_message_id_idx").on(table.messageId),
    index("dm_requests_user_id_idx").on(table.userId),
    index("dm_requests_creator_id_idx").on(table.creatorId),
    index("dm_requests_status_idx").on(table.status),
    index("dm_requests_expires_at_idx").on(table.expiresAt),
  ],
);

export const dmRequestStatusSchema = z.enum([
  "PENDING",
  "COMPLETED",
  "REFUNDED",
  "FAILED",
  "EXPIRED",
]);

export const createDmRequestSchema = createInsertSchema(dmRequests)
  .pick({
    requestId: true,
    requestPda: true,
    escrowTokenAccount: true,
    chatId: true,
    creatorId: true,
    paymentMint: true,
    amount: true,
    createTxSignature: true,
    expiresAt: true,
  })
  .extend({
    requestId: z.number().int().positive(),
    requestPda: z.string().trim().min(32),
    escrowTokenAccount: z.string().trim().min(32),
    messageId: z.string().uuid().optional(),
    content: z.string().trim().min(1).max(2000).optional(),
    paymentMint: z.string().trim().min(32),
    amount: z.string().regex(/^\d+$/),
    createTxSignature: z.string().trim().min(32),
    expiresAt: z.coerce.date(),
  })
  .refine((data) => data.messageId || data.content, {
    message: "Message id or content is required",
  });

export const updateDmRequestStatusSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("COMPLETED"),
    completeTxSignature: z.string().trim().min(32),
  }),
  z.object({
    status: z.literal("REFUNDED"),
    refundTxSignature: z.string().trim().min(32),
  }),
  z.object({
    status: z.literal("FAILED"),
  }),
  z.object({
    status: z.literal("EXPIRED"),
  }),
]);
