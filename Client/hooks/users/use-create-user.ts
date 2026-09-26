"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import type { CreateUserInput } from "@/api/users";
import { usersApi } from "@/api/users";
import { requireAccessToken } from "./require-access-token";
import { userKeys } from "./user-keys";

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { getAccessToken, user } = usePrivy();

  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const token = await requireAccessToken(getAccessToken);
      return usersApi.createUser(input, token);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(userKeys.me(user?.id), response);
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: userKeys.byUsername(response.user.username),
      });
    },
  });
}
