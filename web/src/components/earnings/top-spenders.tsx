import { Leaderboard, type LeaderboardEntry } from "@/components/earnings/leaderboard";
import { LeaderboardSkeleton } from "@/components/skeleton/leaderboard-skeleton";

const spenders: LeaderboardEntry[] = [
  { name: "Demi Wilkinson", initials: "DW", wallet: "0xA620…3F18", amount: 42800 },
  { name: "Drew Cano", initials: "DC", wallet: "0x2B85…E490", amount: 36500 },
  { name: "Olivia Rhye", initials: "OR", wallet: "0x71C4…9A23", amount: 28950 },
  { name: "Lana Steiner", initials: "LS", wallet: "0x4D19…C842", amount: 21400 },
  { name: "Phoenix Baker", initials: "PB", wallet: "0x8F32…B671", amount: 18750 },
];

export function TopSpenders({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <LeaderboardSkeleton title="Top Spenders" />;
  return <Leaderboard title="Top Spenders" amountLabel="Total spent" entries={spenders} />;
}
