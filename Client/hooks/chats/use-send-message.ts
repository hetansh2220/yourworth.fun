"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { chatsApi, type SendMessageInput } from "@/api/chats";
import { requireAccessToken } from "@/hooks/users/require-access-token";
import { chatKeys } from "./chat-keys";

export function useSendMessage(chatId: string) {
  const queryClient = useQueryClient();
  const { getAccessToken } = usePrivy();

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const token = await requireAccessToken(getAccessToken);
      return chatsApi.sendMessage(chatId, input, token);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
    },
  });
}
