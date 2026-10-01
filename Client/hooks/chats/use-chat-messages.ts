"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { chatsApi } from "@/api/chats";
import { requireAccessToken } from "@/hooks/users/require-access-token";
import { chatKeys } from "./chat-keys";

export function useChatMessages(chatId: string, limit = 30) {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useInfiniteQuery({
    queryKey: chatKeys.messages(chatId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const token = await requireAccessToken(getAccessToken);
      return chatsApi.getMessages(
        chatId,
        {
          limit,
          before: pageParam,
        },
        token
      );
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMoreOlder ? lastPage.olderCursor : undefined,
    enabled: ready && authenticated && chatId.length > 0,
  });
}
