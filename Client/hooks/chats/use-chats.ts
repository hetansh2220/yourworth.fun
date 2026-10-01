"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { chatsApi } from "@/api/chats";
import { requireAccessToken } from "@/hooks/users/require-access-token";
import { chatKeys } from "./chat-keys";

export function useChats() {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useQuery({
    queryKey: chatKeys.lists(),
    queryFn: async () => {
      const token = await requireAccessToken(getAccessToken);
      return chatsApi.getChats(token);
    },
    enabled: ready && authenticated,
  });
}
