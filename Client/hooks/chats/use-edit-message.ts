"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { chatsApi, type EditMessageInput } from "@/api/chats";
import { requireAccessToken } from "@/hooks/users/require-access-token";
import { chatKeys } from "./chat-keys";

export function useEditMessage(chatId: string) {
  const queryClient = useQueryClient();
  const { getAccessToken } = usePrivy();

  return useMutation({
    mutationFn: async (input: EditMessageInput) => {
      const token = await requireAccessToken(getAccessToken);
      return chatsApi.editMessage(chatId, input, token);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
    },
  });
}
