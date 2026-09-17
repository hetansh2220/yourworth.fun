"use client";

import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/api/users";
import { userKeys } from "./user-keys";

export function useUser(username: string) {
  const cleanUsername = username.trim().toLowerCase();

  return useQuery({
    queryKey: userKeys.byUsername(cleanUsername),
    queryFn: () => usersApi.getUserByUsername(cleanUsername),
    enabled: cleanUsername.length > 0,
  });
}
