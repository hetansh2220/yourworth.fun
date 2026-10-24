import { BankIcon, ArrowDownLeftIcon, ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const balances = [
  { title: "Total Balance", amount: "$2,00,000", icon: BankIcon },
  { title: "Deposits", amount: "$12,000", icon: ArrowDownLeftIcon },
  { title: "Withdrawals", amount: "$80,000", icon: ArrowUpRightIcon },
];

export function BalanceCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {balances.map(({ title, amount, icon: Icon }) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardAction><Icon size={20} aria-hidden="true" /></CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{amount}</p>
            <CardDescription>In the past 12 months</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
