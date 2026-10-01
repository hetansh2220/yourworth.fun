"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { chatsApi } from "@/api/chats";
import { requireAccessToken } from "@/hooks/users/require-access-token";
import { chatKeys } from "./chat-keys";

export function useDeleteMessage(chatId: string) {
  const queryClient = useQueryClient();
  const { getAccessToken } = usePrivy();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const token = await requireAccessToken(getAccessToken);
      return chatsApi.deleteMessage(chatId, messageId, token);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
    },
  });
}
