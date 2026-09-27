"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { ApiError } from "@/api";
import { usersApi } from "@/api/users";
import { requireAccessToken } from "./require-access-token";
import { userKeys } from "./user-keys";

export function useCurrentUser() {
  const { ready, authenticated, getAccessToken, user } = usePrivy();
  const privyUserId = user?.id;

  return useQuery({
    queryKey: userKeys.me(privyUserId),
    queryFn: async () => {
      const token = await requireAccessToken(getAccessToken);
      return usersApi.getMe(token);
    },
    enabled: ready && authenticated && Boolean(privyUserId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) {
        return false;
      }

      return failureCount < 2;
    },
  });
}
