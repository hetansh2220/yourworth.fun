"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import {
  connectTwitter,
  createSocials,
  getMySocials,
  getSocials,
  updateSocials,
  type Socials,
  type SocialsInput,
} from "@/utils/api/socials";

export const socialsQueryKey = ["socials", "current"] as const;
export const userSocialsQueryKey = (userId: string) => ["socials", userId] as const;

const missingTokenError = () => new Error("Your session is unavailable. Please try again.");

export function useMySocials({ enabled = true }: { enabled?: boolean } = {}) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  return useQuery<Socials | null, Error>({
    queryKey: socialsQueryKey,
    enabled: ready && authenticated && enabled,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw missingTokenError();
      return getMySocials(token);
    },
  });
}

export function useSocials(userId: string | undefined) {
  const { getAccessToken } = usePrivy();
  return useQuery<Socials | null, Error>({
    queryKey: userSocialsQueryKey(userId ?? ""),
    enabled: Boolean(userId),
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token || !userId) throw missingTokenError();
      return getSocials(token, userId);
    },
  });
}

export function useCreateSocials() {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  return useMutation<Socials, Error, SocialsInput>({
    mutationFn: async (input) => {
      const token = await getAccessToken();
      if (!token) throw missingTokenError();
      return createSocials(token, input);
    },
    onSuccess: (socials) => queryClient.setQueryData(socialsQueryKey, socials),
  });
}

export function useUpdateSocials() {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  return useMutation<Socials, Error, SocialsInput>({
    mutationFn: async (input) => {
      const token = await getAccessToken();
      if (!token) throw missingTokenError();
      return updateSocials(token, input);
    },
    onSuccess: (socials) => queryClient.setQueryData(socialsQueryKey, socials),
  });
}

export function useConnectTwitter() {
  const { getAccessToken } = usePrivy();
  return useMutation<string, Error, void>({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw missingTokenError();
      return connectTwitter(token);
    },
    onSuccess: (url) => window.location.assign(url),
  });
}
