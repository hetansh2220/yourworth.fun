import { apiFetch } from "../api-client";
import type {
  CreateUserInput,
  PublicUserResponse,
  UpdateUserInput,
  UserResponse,
  UsersResponse,
} from "./types";

export const usersApi = {
  getUsers() {
    return apiFetch<UsersResponse>("/users");
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
