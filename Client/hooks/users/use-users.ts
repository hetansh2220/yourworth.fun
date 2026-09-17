"use client";

import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/api/users";
import { userKeys } from "./user-keys";

export function useUsers() {
  return useQuery({
    queryKey: userKeys.lists(),
    queryFn: () => usersApi.getUsers(),
  });
}
