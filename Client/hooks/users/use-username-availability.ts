"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/api";
import { usersApi } from "@/api/users";
import { userKeys } from "./user-keys";

export function useUsernameAvailability(username: string, enabled = true) {
  const cleanUsername = username.trim().toLowerCase();

  return useQuery({
    queryKey: userKeys.availability(cleanUsername),
    queryFn: async () => {
      try {
        await usersApi.getUserByUsername(cleanUsername);
        return { available: false };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return { available: true };
        }

        throw error;
      }
    },
    enabled: enabled && cleanUsername.length > 0,
    retry: false,
    staleTime: 10_000,
  });
}
