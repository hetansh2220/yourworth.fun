import { api } from "@/lib/api";

export type ChatType = "DM" | "GROUP";

export type Chat = {
  id: string;
  type: ChatType;
  admin: string;
  createdAt: string;
  updatedAt: string;
  lastReadAt: string | null;
  membersCount: number;
};

export type ChatParticipant = {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
  joinedAt?: string;
};

export type ChatMembersResponse = {
  members: ChatParticipant[];
};

export type ChatMessage = {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  sender: ChatParticipant;
};

export type MessagesResponse = {
  messages: ChatMessage[];
  limit: number;
  offset: number;
};

export type CreateDMInput = {
  userId: string;
  message: string;
};

export type CreateDMResponse = {
  chat: Chat;
  message: ChatMessage;
};


export async function getChats(accessToken: string): Promise<Chat[]> {
  const response = await api<{ chats: Chat[] }>("/chats", {
    accessToken,
  });

  return response.chats;
}


export async function getChat(
  accessToken: string,
  chatId: string,
): Promise<Chat> {
  const response = await api<{ chat: Chat }>(
    `/chats/${encodeURIComponent(chatId)}`,
    { accessToken },
  );

  return response.chat;
}


export async function getMessages(
  accessToken: string,
  chatId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<MessagesResponse> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));

  const query = params.toString();
  return api<MessagesResponse>(
    `/chats/${encodeURIComponent(chatId)}/messages${query ? `?${query}` : ""}`,
    { accessToken },
  );
}

export async function getChatMembers(
  accessToken: string,
  chatId: string,
): Promise<ChatMembersResponse> {
  return api<ChatMembersResponse>(
    `/chats/${encodeURIComponent(chatId)}/members`,
    { accessToken },
  );
}

export async function createDM(
  accessToken: string,
  input: CreateDMInput,
): Promise<CreateDMResponse> {
  return api<CreateDMResponse>("/chats/dm", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
