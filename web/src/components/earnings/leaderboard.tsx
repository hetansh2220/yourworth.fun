import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export type LeaderboardEntry = {
  name: string;
  initials: string;
  wallet: string;
  amount: number;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function Leaderboard({ title, amountLabel, entries }: {
  title: string;
  amountLabel: string;
  entries: LeaderboardEntry[];
}) {
  const rankedEntries = [...entries].sort((a, b) => b.amount - a.amount);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table aria-label={title}>
          <TableBody>
            {rankedEntries.map((entry) => (
              <TableRow key={entry.wallet} className="border-0">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar><AvatarFallback>{entry.initials}</AvatarFallback></Avatar>
                    <p className="font-medium">{entry.name}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums"><span className="sr-only">{amountLabel}: </span>{currency.format(entry.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
