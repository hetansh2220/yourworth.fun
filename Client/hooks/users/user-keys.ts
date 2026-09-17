export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  byUsername: (username: string) =>
    [...userKeys.all, "username", username.toLowerCase()] as const,
  availability: (username: string) =>
    [...userKeys.all, "availability", username.toLowerCase()] as const,
  me: () => [...userKeys.all, "me"] as const,
};
