"use client";

import { DepositDialog } from "@/components/dialogs/deposit-dialog";
import { WithdrawDialog } from "@/components/dialogs/withdraw-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/hooks/use-profile";
import { usePortfolioBalance } from "@/hooks/use-portfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";

export function TotalBalance() {
  const { data: balance, isLoading } = usePortfolioBalance();
  const { data: profile } = useProfile();
  const { wallets } = useSolanaWallets();
  const depositAddress = profile?.walletAddress || wallets[0]?.address;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Balance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <Skeleton className="h-9 w-40" />
        ) : (
          <p className="text-3xl font-semibold tabular-nums">
            ${(balance ?? 0).toFixed(2)}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <DepositDialog address={depositAddress} />
          <WithdrawDialog />
        </div>
      </CardContent>
    </Card>
  );
}
