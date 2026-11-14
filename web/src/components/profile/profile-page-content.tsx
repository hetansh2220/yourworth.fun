"use client";

import { UserCircleIcon } from "@phosphor-icons/react";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileOverview } from "@/components/profile/profile-overview";
import { ProfileTradingChart } from "@/components/profile/profile-trading-chart";
import { ProfileTradingPanel } from "@/components/profile/profile-trading-panel";
import { ProfileReviews } from "@/components/profile/profile-reviews";
import { useUsers } from "@/hooks/use-profile";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfilePageContent({ username }: { username: string }) {
  const { data, isLoading } = useUsers();
  const profile = data?.users.find((user) => user.username === username);

  if (isLoading) {
    return (
      <main className="w-full p-4 sm:p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
          <Skeleton className="size-32 rounded-xl sm:size-40 lg:size-48" />
          <div className="w-full max-w-xl space-y-4 sm:py-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-5 w-full max-w-lg" />
            <Skeleton className="h-5 w-40" />
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center p-6">
        <section className="max-w-md space-y-3 text-center">
          <UserCircleIcon size={56} className="mx-auto text-muted-foreground" aria-hidden="true" />
          <h1 className="text-2xl font-medium">User not found</h1>
          <p className="text-muted-foreground">
            We couldn&apos;t find a profile for <span className="font-medium text-foreground">@{username}</span>.
            Check the username and try again.
          </p>
        </section>
      </main>
    );
  }

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
