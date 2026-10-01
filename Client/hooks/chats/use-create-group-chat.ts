"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { chatsApi, type CreateGroupChatInput } from "@/api/chats";
import { requireAccessToken } from "@/hooks/users/require-access-token";
import { chatKeys } from "./chat-keys";

export function useCreateGroupChat() {
  const queryClient = useQueryClient();
  const { getAccessToken } = usePrivy();

  return useMutation({
    mutationFn: async (input: CreateGroupChatInput) => {
      const token = await requireAccessToken(getAccessToken);
      return chatsApi.createGroupChat(input, token);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(chatKeys.detail(response.chat.id), response);
      void queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
    },
  });
}
