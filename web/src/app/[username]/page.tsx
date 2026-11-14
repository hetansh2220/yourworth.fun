import { ProfilePageContent } from "@/components/profile/profile-page-content";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type ProfilePageProps = {
  params: Promise<{ username: string }>;
};

export const instant = false;

async function getUsername(params: ProfilePageProps["params"]) {
  const { username } = await params;
  if (
    !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,29}$/.test(username) ||
    username === "settings"
  ) {
    notFound();
  }
  return username;
}

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const username = await getUsername(params);
  return { title: `@${username} | Worth` };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const username = await getUsername(params);

  return <ProfilePageContent username={username} />;
}
