"use client";

import {
  useQuery,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import {
  getChat,
  getChats,
  getMessages,
  getChatMembers,
  type Chat,
  type ChatParticipant,
  type MessagesResponse,
} from "@/utils/api/chats";

export const chatsQueryKey = ["chats"] as const;

export const chatQueryKey = (chatId: string) => ["chat", chatId] as const;

export const chatMessagesQueryKey = (chatId: string) =>
  ["chat-messages", chatId] as const;

export const chatMembersQueryKey = (chatId: string) =>
  ["chat-members", chatId] as const;

function missingTokenError() {
  return new Error("Your session is unavailable. Please try again.");
}

export function useChats(
  options?: Omit<UseQueryOptions<Chat[], Error>, "queryKey" | "queryFn" | "enabled"> & {
    enabled?: boolean;
  },
) {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useQuery({
    ...options,
    queryKey: chatsQueryKey,
    enabled: ready && authenticated && (options?.enabled ?? true),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw missingTokenError();
      return getChats(accessToken);
    },
  });
}

export function useChat(
  chatId: string | undefined,
  options?: Omit<UseQueryOptions<Chat, Error>, "queryKey" | "queryFn" | "enabled"> & {
    enabled?: boolean;
  },
) {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useQuery({
    ...options,
    queryKey: chatQueryKey(chatId ?? ""),
    enabled: ready && authenticated && Boolean(chatId) && (options?.enabled ?? true),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken || !chatId) throw missingTokenError();
      return getChat(accessToken, chatId);
    },
  });
}

export function useMessages(
  chatId: string | undefined,
  options?: Omit<UseQueryOptions<MessagesResponse, Error>, "queryKey" | "queryFn" | "enabled"> & {
    enabled?: boolean;
  },
) {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useQuery({
    ...options,
    queryKey: chatMessagesQueryKey(chatId ?? ""),
    enabled: ready && authenticated && Boolean(chatId) && (options?.enabled ?? true),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken || !chatId) throw missingTokenError();
      return getMessages(accessToken, chatId);
    },
  });
}

export function useChatMembers(
  chatId: string | undefined,
  options?: Omit<
    UseQueryOptions<ChatParticipant[], Error>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean },
) {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useQuery({
    ...options,
    queryKey: chatMembersQueryKey(chatId ?? ""),
    enabled:
      ready &&
      authenticated &&
      Boolean(chatId) &&
      (options?.enabled ?? true),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken || !chatId) throw missingTokenError();
      const response = await getChatMembers(accessToken, chatId);
      return response.members;
    },
  });
}
