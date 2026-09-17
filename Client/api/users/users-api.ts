import { apiFetch } from "../api-client";
import type {
  CreateUserInput,
  PublicUserResponse,
  UpdateUserInput,
  UserResponse,
  UsersResponse,
} from "./types";

export type GetUsersParams = {
  limit?: number;
  cursor?: string | null;
};

export const usersApi = {
  getUsers(params: GetUsersParams = {}) {
    const searchParams = new URLSearchParams();

    if (params.limit) {
      searchParams.set("limit", String(params.limit));
    }

    if (params.cursor) {
      searchParams.set("cursor", params.cursor);
    }

    const query = searchParams.toString();

    return apiFetch<UsersResponse>(`/users${query ? `?${query}` : ""}`);
  },

  getUserByUsername(username: string) {
    return apiFetch<PublicUserResponse>(`/${encodeURIComponent(username)}`);
  },

  getMe(token: string) {
    return apiFetch<UserResponse>("/users/me", { token });
  },

  createUser(input: CreateUserInput, token: string) {
    return apiFetch<UserResponse>("/users", {
      method: "POST",
      body: input,
      token,
    });
  },

  updateUser(input: UpdateUserInput, token: string) {
    return apiFetch<UserResponse>("/users/me", {
      method: "PATCH",
      body: input,
      token,
    });
  },
};
