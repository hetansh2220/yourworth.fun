import { DepositDialog } from "@/components/dialogs/deposit-dialog";
import { WithdrawDialog } from "@/components/dialogs/withdraw-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TotalBalance({ depositAddress }: { depositAddress?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Balance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-3xl font-semibold tabular-nums">$2,00,000</p>
        <div className="grid grid-cols-2 gap-2">
          <DepositDialog address={depositAddress} />
          <WithdrawDialog />
        </div>
      </CardContent>
    </Card>
  );
}
