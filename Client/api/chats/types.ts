import type { ApiSuccess } from "../api-client";

export type ChatType = "DM" | "GROUP";

export type ChatUser = {
  id: string;
  username: string;
  avatar: string;
  bio?: string;
};

export type ChatMember = {
  user: ChatUser;
  joinedAt: string;
  lastReadAt: string | null;
};

export type Chat = {
  id: string;
  type: ChatType;
  admin: string;
  createdAt: string;
  updatedAt: string;
  lastReadAt?: string | null;
  unreadCount?: number;
  members: ChatMember[];
};

export type ChatMessage = {
  id: string;
  chatId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: Pick<ChatUser, "id" | "username" | "avatar">;
};

export type CreateDmChatInput = {
  userId?: string;
  username?: string;
};

export type CreateGroupChatInput = {
  memberIds: string[];
};

export type AddGroupMemberInput = {
  userId: string;
};

export type SendMessageInput = {
  content: string;
};

export type EditMessageInput = {
  messageId: string;
  content: string;
};

export type GetMessagesParams = {
  limit?: number;
  before?: string | null;
  after?: string | null;
};

export type ChatResponse = ApiSuccess<{
  message?: string;
  chat: Chat;
}>;

export type ChatsResponse = ApiSuccess<{
  chats: Chat[];
}>;

export type MessagesResponse = ApiSuccess<{
  messages: ChatMessage[];
  olderCursor: string | null;
  newerCursor: string | null;
  hasMoreOlder: boolean;
  hasMoreNewer: boolean;
}>;

export type MessageResponse = ApiSuccess<{
  message: string;
  chatMessage: ChatMessage | null;
}>;

export type MarkChatReadResponse = ApiSuccess<{
  message: string;
  lastReadAt: string;
}>;

export type ChatSocketEvent =
  | { type: "connected"; chatId: string }
  | { type: "message.created"; message: ChatMessage }
  | { type: "message.updated"; message: ChatMessage | null }
  | { type: "message.deleted"; message: ChatMessage | null }
  | { type: "typing.start"; chatId: string; userId: string }
  | { type: "typing.stop"; chatId: string; userId: string }
  | { type: "chat.read"; chatId: string; userId: string; lastReadAt: string }
  | { type: "error"; message: string };
