import { api } from "@/lib/api";

export type User = {
  id: string;
  privyUserId: string;
  username: string;
  walletAddress: string;
  avatar: string;
  bio: string;
  token: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserInput = {
  username: string;
  bio: string;
  avatar: File;
};

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
  body.set("bio", input.bio);
  body.set("avatar", input.avatar);

  const response = await api<{ user: User }>("/users", {
    method: "POST",
    accessToken,
    body,
  });
  return response.user;
}
