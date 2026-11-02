"use client";

import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import { useUsers } from "@/hooks/use-profile";
import { ExploreSection, type ExploreProfile } from "@/components/explore/explore-section";
import { ProfileCardSkeleton } from "@/components/skeleton/profile-card-skeleton";

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
        <section aria-label="Loading users" className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-7 w-32 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="h-10 w-24 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="flex gap-6 overflow-hidden p-1">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="w-[220px] shrink-0 sm:w-[240px]">
                <ProfileCardSkeleton />
              </div>
            ))}
          </div>
        </section>
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
