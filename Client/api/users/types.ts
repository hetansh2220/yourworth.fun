import type { ApiSuccess } from "../api-client";

export type PublicUser = {
  id: string;
  username: string;
  avatar: string;
  createdAt: string;
};

export type User = PublicUser & {
  privyUserId: string;
  walletAddress: string;
};

export type UsersResponse = ApiSuccess<{
  users: PublicUser[];
  nextCursor: string | null;
}>;

export type UserResponse = ApiSuccess<{
  user: User;
}>;

export type PublicUserResponse = ApiSuccess<{
  user: PublicUser;
}>;

export type CreateUserInput = {
  username: string;
};

export type UpdateUserInput = {
  username?: string;
  avatar?: string;
};
