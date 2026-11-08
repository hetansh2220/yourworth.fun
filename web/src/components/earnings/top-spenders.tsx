"use client";

import {
  Leaderboard,
  type LeaderboardEntry,
} from "@/components/earnings/leaderboard";
import { LeaderboardSkeleton } from "@/components/skeleton/leaderboard-skeleton";
import { useEarningsSpenders } from "@/hooks/use-earnings";

export function TopSpenders({ isLoading = false }: { isLoading?: boolean }) {
  const { data, isLoading: spendersLoading } = useEarningsSpenders();
  const entries: LeaderboardEntry[] = (data?.spenders ?? []).map((spender) => ({
    name: spender.name,
    initials: spender.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    wallet: spender.id,
    amount: Number(spender.amount),
  }));
  if (isLoading || spendersLoading)
    return <LeaderboardSkeleton title="Spenders" />;
  return (
    <Leaderboard title="Spenders" amountLabel="Total spent" entries={entries} />
  );
}
