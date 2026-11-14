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

  return (
    <main className="w-full p-4 sm:p-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <ProfileHeader username={username} />
          <ProfileTradingChart />
          <ProfileOverview username={username} />
        </div>
        <div className="min-w-0 space-y-6">
          <ProfileTradingPanel username={username} />
          <ProfileReviews username={username} />
        </div>
      </div>
    </main>
  );
}
