"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { chatsApi } from "@/api/chats";
import { requireAccessToken } from "@/hooks/users/require-access-token";
import { chatKeys } from "./chat-keys";

export function useMarkChatRead(chatId: string) {
  const queryClient = useQueryClient();
  const { getAccessToken } = usePrivy();

  return useMutation({
    mutationFn: async () => {
      const token = await requireAccessToken(getAccessToken);
      return chatsApi.markChatRead(chatId, token);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    },
  });
}
