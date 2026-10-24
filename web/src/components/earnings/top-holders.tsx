import { Leaderboard, type LeaderboardEntry } from "@/components/earnings/leaderboard";

const holders: LeaderboardEntry[] = [
  { name: "Olivia Rhye", initials: "OR", wallet: "0x71C4…9A23", amount: 128450 },
  { name: "Phoenix Baker", initials: "PB", wallet: "0x8F32…B671", amount: 96200 },
  { name: "Lana Steiner", initials: "LS", wallet: "0x4D19…C842", amount: 78400 },
  { name: "Demi Wilkinson", initials: "DW", wallet: "0xA620…3F18", amount: 65350 },
  { name: "Drew Cano", initials: "DC", wallet: "0x2B85…E490", amount: 52100 },
];

export function TopHolders() {
  return <Leaderboard title="Top Holders" amountLabel="Holdings" entries={holders} />;
}
