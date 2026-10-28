import { api } from "@/lib/api";

export type WatchlistEntry = {
  id: string;
  userId: string;
  watchedUserId: string;
  createdAt: string;
};

type WatchlistResponse = {
  success: true;
  message: string;
  entry?: WatchlistEntry;
};

export type WatchlistMutationResult = {
  message: string;
  entry?: WatchlistEntry;
};

export type WatchlistItem = {
  id: string;
  watchedUserId: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    name: string;
    avatar: string;
    bio: string;
    verified: boolean;
    token: string | null;
  };
};

/** Get the signed-in user's watched public profiles. */
export async function getWatchlist(
  accessToken: string,
): Promise<WatchlistItem[]> {
  const response = await api<{ success: true; watchlist: WatchlistItem[] }>(
    "/watchlist",
    { accessToken },
  );
  return response.watchlist ?? [];
}

/** Add a public user to the signed-in user's watchlist. */
export async function addToWatchlist(
  accessToken: string,
  watchedUserId: string,
): Promise<WatchlistMutationResult> {
  const response = await api<WatchlistResponse>("/watchlist", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ watchedUserId }),
  });

  return {
    message: response.message,
    entry: response.entry,
  };
}

/** Remove a public user from the signed-in user's watchlist. */
export async function removeFromWatchlist(
  accessToken: string,
  watchedUserId: string,
): Promise<WatchlistMutationResult> {
  const response = await api<WatchlistResponse>(
    `/watchlist/${encodeURIComponent(watchedUserId)}`,
    {
      method: "DELETE",
      accessToken,
    },
  );

  return {
    message: response.message,
    entry: response.entry,
  };
}
