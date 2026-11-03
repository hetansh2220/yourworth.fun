"use client";

import {
  BankIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
} from "@phosphor-icons/react/dist/ssr";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBalance } from "@/hooks/use-balance";
import { Skeleton } from "@/components/ui/skeleton";

export function BalanceCards() {
  const { data: balance, isLoading } = useBalance();
  const balanceLabel = isLoading ? "Loading…" : `$${(balance ?? 0).toFixed(2)}`;
  const balances = [
    { title: "Total Balance", amount: balanceLabel, icon: BankIcon },
    { title: "Deposits", amount: "$0.00", icon: ArrowDownLeftIcon },
    { title: "Withdrawals", amount: "$0.00", icon: ArrowUpRightIcon },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {balances.map(({ title, amount, icon: Icon }) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardAction>
              <Icon size={20} aria-hidden="true" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {isLoading && title === "Total Balance" ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{amount}</p>
            )}
            <CardDescription>In the past 12 months</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
