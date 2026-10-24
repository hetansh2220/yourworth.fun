import { api } from "@/lib/api";

export type User = {
  id: string;
  privyUserId: string;
  username: string;
  displayName: string;
  walletAddress: string;
  avatar: string;
  bio: string;
  token: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserInput = {
  username: string;
  displayName: string;
  bio: string;
  avatar: File | string;
};

export type UpdateUserInput = {
  username?: string;
  displayName?: string;
  bio?: string;
  /** URL of an uploaded avatar, as required by the update endpoint. */
  avatar?: string;
};

export async function checkUsernameAvailability(username: string) {
  return api<{ success: boolean; available: boolean }>(
    `/users/availability?username=${encodeURIComponent(username)}`,
  );
}

export async function createUser(
  accessToken: string,
  input: CreateUserInput,
): Promise<User> {
  const body =
    input.avatar instanceof File
      ? (() => {
          const formData = new FormData();
          formData.set("username", input.username);
          formData.set("displayName", input.displayName.trim());
          formData.set("bio", input.bio);
          formData.set("avatar", input.avatar);
          return formData;
        })()
      : JSON.stringify({
          username: input.username,
          displayName: input.displayName.trim(),
          bio: input.bio,
          avatar: input.avatar,
        });

  const response = await api<{ user: User }>("/users", {
    method: "POST",
    accessToken,
    ...(typeof body === "string"
      ? { headers: { "Content-Type": "application/json" } }
      : {}),
    body,
  });
  return response.user;
}

export async function updateUser(
  accessToken: string,
  input: UpdateUserInput,
): Promise<User> {
  const response = await api<{ user: User }>("/users/me", {
    method: "PATCH",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.user;
}

export async function getUser(accessToken: string): Promise<User> {
  const response = await api<{ user: User }>("/users/me", {
    accessToken,
    cache: "no-store",
  });
  return response.user;
}