import { api } from "@/lib/api";

export type Socials = {
  id: string;
  userId: string;
  twitterUsername: string | null;
  instagramUsername: string | null;
  youtubeUsername: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialsInput = {
  twitterUsername?: string;
  instagramUsername?: string;
  youtubeUsername?: string;
};

export async function connectTwitter(accessToken: string) {
  const response = await api<{ url: string }>("/socials/twitter/connect", {
    method: "GET",
    accessToken,
  });
  return response.url;
}

export async function createSocials(accessToken: string, input: SocialsInput) {
  const response = await api<{ socials: Socials }>("/socials", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.socials;
}

export async function updateSocials(accessToken: string, input: SocialsInput) {
  const response = await api<{ socials: Socials }>("/socials", {
    method: "PATCH",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.socials;
}

export async function getMySocials(accessToken: string) {
  const response = await api<{ socials: Socials | null }>("/socials", {
    accessToken,
  });
  return response.socials;
}

export async function getSocials(accessToken: string, userId: string) {
  const response = await api<{ socials: Socials | null }>(
    `/socials/${encodeURIComponent(userId)}`,
    { accessToken },
  );
  return response.socials;
}
