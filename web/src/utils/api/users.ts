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
  avatar: File;
};

export type UpdateUserInput = {
  username?: string;
  displayName?: string;
  bio?: string;
  /** URL of an uploaded avatar, as required by the update endpoint. */
  avatar?: string;
};

/** Update the signed-in user's profile and return the saved user. */
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

/** Get the signed-in user's profile using a Privy access token. */
export async function getUser(accessToken: string): Promise<User> {
  const response = await api<{ user: User }>("/users/me", {
    accessToken,
    cache: "no-store",
  });
  return response.user;
}

/** Create a profile. The backend obtains the wallet address from Privy. */
export async function createUser(
  accessToken: string,
  input: CreateUserInput,
): Promise<User> {
  const body = new FormData();
  body.set("username", input.username);
  body.set("displayName", input.displayName.trim());
  body.set("bio", input.bio);
  body.set("avatar", input.avatar);

  const response = await api<{ user: User }>("/users", {
    method: "POST",
    accessToken,
    body,
  });
  return response.user;
}
