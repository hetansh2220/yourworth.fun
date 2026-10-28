"use client";

import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import { useUsers } from "@/hooks/use-profile";
import { ExploreSection, type ExploreProfile } from "@/components/explore/explore-section";

export function ExploreScreen() {
  const { data, isLoading, isError } = useUsers();
  const profiles: ExploreProfile[] = (data?.users ?? []).map((user) => ({
    username: user.username,
    name: user.name,
    bio: user.bio,
    imageSrc: user.avatar,
    verified: user.verified,
    minutePrice: 0,
    change24h: 0,
  }));

  return (
    <main className="w-full min-w-0 space-y-10 p-4 sm:p-6">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading users…</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-destructive">Could not load users.</p>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users found yet.</p>
      ) : (
        <ExploreSection
          id="users"
          title="All users"
          description="Discover creators and connect with the community"
          icon={<UsersThreeIcon size={26} />}
          profiles={profiles}
        />
      )}
    </main>
  );
}
