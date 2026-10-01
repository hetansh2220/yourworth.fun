import { apiFetch, createWebSocketUrl } from "../api-client";
import type {
  AddGroupMemberInput,
  ChatResponse,
  ChatsResponse,
  CreateDmChatInput,
  CreateGroupChatInput,
  EditMessageInput,
  GetMessagesParams,
  MarkChatReadResponse,
  MessageResponse,
  MessagesResponse,
  SendMessageInput,
} from "./types";

function createMessagesQuery(params: GetMessagesParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.limit) {
    searchParams.set("limit", String(params.limit));
  }

  if (params.before) {
    searchParams.set("before", params.before);
  }

  if (params.after) {
    searchParams.set("after", params.after);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export const chatsApi = {
  createDmChat(input: CreateDmChatInput, token: string) {
    return apiFetch<ChatResponse>("/chats/dm", {
      method: "POST",
      body: input,
      token,
    });
  },

  createGroupChat(input: CreateGroupChatInput, token: string) {
    return apiFetch<ChatResponse>("/chats/group", {
      method: "POST",
      body: input,
      token,
    });
  },

  getChats(token: string) {
    return apiFetch<ChatsResponse>("/chats", { token });
  },

  getChat(chatId: string, token: string) {
    return apiFetch<ChatResponse>(`/chats/${chatId}`, { token });
  },

  markChatRead(chatId: string, token: string) {
    return apiFetch<MarkChatReadResponse>(`/chats/${chatId}/read`, {
      method: "PATCH",
      token,
    });
  },

  getMessages(chatId: string, params: GetMessagesParams, token: string) {
    return apiFetch<MessagesResponse>(
      `/chats/${chatId}/messages${createMessagesQuery(params)}`,
      { token }
    );
  },

  sendMessage(chatId: string, input: SendMessageInput, token: string) {
    return apiFetch<MessageResponse>(`/chats/${chatId}/messages`, {
      method: "POST",
      body: input,
      token,
    });
  },

  editMessage(chatId: string, input: EditMessageInput, token: string) {
    return apiFetch<MessageResponse>(
      `/chats/${chatId}/messages/${input.messageId}`,
      {
        method: "PATCH",
        body: { content: input.content },
        token,
      }
    );
  },

  deleteMessage(chatId: string, messageId: string, token: string) {
    return apiFetch<MessageResponse>(`/chats/${chatId}/messages/${messageId}`, {
      method: "DELETE",
      token,
    });
  },

  addGroupMember(chatId: string, input: AddGroupMemberInput, token: string) {
    return apiFetch<ChatResponse>(`/chats/${chatId}/members`, {
      method: "POST",
      body: input,
      token,
    });
  },

  removeGroupMember(chatId: string, userId: string, token: string) {
    return apiFetch<{ success: true; message: string }>(
      `/chats/${chatId}/members/${userId}`,
      {
        method: "DELETE",
        token,
      }
    );
  },

  getWebSocketUrl(chatId: string) {
    return createWebSocketUrl(`/chats/${chatId}/ws`);
  },
};
