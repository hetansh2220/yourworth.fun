"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { usersApi } from "@/api/users";
import { requireAccessToken } from "./require-access-token";
import { userKeys } from "./user-keys";

export function useCurrentUser() {
  const { authenticated, getAccessToken } = usePrivy();

  return useQuery({
    queryKey: userKeys.me(),
    queryFn: async () => {
      const token = await requireAccessToken(getAccessToken);
      return usersApi.getMe(token);
    },
    enabled: authenticated,
    retry: false,
  });
}
