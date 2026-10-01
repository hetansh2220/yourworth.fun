import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import { chats, messages, users } from "../../db/schema";

export const messageContentSchema = z.string().trim().min(1).max(2000);

export const messageFields = {
  id: messages.id,
  chatId: messages.chatId,
  content: messages.content,
  createdAt: messages.createdAt,
  updatedAt: messages.updatedAt,
  editedAt: messages.editedAt,
  deletedAt: messages.deletedAt,
  sender: {
    id: users.id,
    username: users.username,
    avatar: users.avatar,
  },
};

export async function getChatMessage(messageId: string) {
  const [message] = await db
    .select(messageFields)
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.id, messageId))
    .limit(1);

  return message;
}

export async function createChatMessage(
  chatId: string,
  senderId: string,
  content: string
) {
  const [newMessage] = await db
    .insert(messages)
    .values({
      chatId,
      senderId,
      content,
    })
    .returning({ id: messages.id });

  if (!newMessage) {
    throw new Error("Failed to create message");
  }

  await db
    .update(chats)
    .set({ updatedAt: new Date() })
    .where(eq(chats.id, chatId));

  return getChatMessage(newMessage.id);
}

export async function updateChatMessageContent(
  chatId: string,
  messageId: string,
  content: string
) {
  const now = new Date();
  const [updatedMessage] = await db
    .update(messages)
    .set({
      content,
      editedAt: now,
      updatedAt: now,
    })
    .where(eq(messages.id, messageId))
    .returning({ id: messages.id });

  if (!updatedMessage) {
    return null;
  }

  await db
    .update(chats)
    .set({ updatedAt: now })
    .where(eq(chats.id, chatId));

  return getChatMessage(updatedMessage.id);
}

export async function deleteChatMessage(chatId: string, messageId: string) {
  const now = new Date();
  const [deletedMessage] = await db
    .update(messages)
    .set({
      content: "",
      deletedAt: now,
      updatedAt: now,
    })
    .where(eq(messages.id, messageId))
    .returning({ id: messages.id });

  if (!deletedMessage) {
    return null;
  }

  await db
    .update(chats)
    .set({ updatedAt: now })
    .where(eq(chats.id, chatId));

  return getChatMessage(deletedMessage.id);
}
