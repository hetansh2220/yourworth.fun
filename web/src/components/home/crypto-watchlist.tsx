"use client";

import { useWatchlist } from "@/hooks/use-watchlist";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { SealCheckIcon } from "@phosphor-icons/react/dist/ssr";

const demoMarketData = [
  { price: 67432.8, change: 2.34 },
  { price: 3521.65, change: 1.82 },
  { price: 148.92, change: -0.76 },
  { price: 592.4, change: 0.95 },
  { price: 14.28, change: -1.23 },
];

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const changeFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  signDisplay: "always",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});



export function CryptoWatchlist() {
  const { data, isLoading, isError } = useWatchlist();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watchlist</CardTitle>
      </CardHeader>
      <CardContent>
        <Table aria-label="Watchlist" className="border-separate border-spacing-0">
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground">Loading watchlist…</TableCell></TableRow> : isError ? <TableRow><TableCell colSpan={2} className="text-center text-sm text-destructive">Could not load watchlist.</TableCell></TableRow> : data?.length ? data.map((entry, index) => {
              const market = demoMarketData[index % demoMarketData.length];
              return (
              <TableRow key={entry.id} className="border-0 hover:bg-transparent hover:[&>td]:bg-muted/50">
                <TableCell className="rounded-l-md">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={entry.user.avatar} alt={entry.user.name} />
                      <AvatarFallback>{entry.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="flex items-center gap-1 font-medium">
                        {entry.user.name}
                        {entry.user.verified ? (
                          <SealCheckIcon
                            aria-label="Verified"
                            weight="fill"
                            className="size-4 text-sky-400"
                          />
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">@{entry.user.username}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="rounded-r-md text-right">
                  <p className="font-medium tabular-nums">{priceFormatter.format(market.price)}</p>
                  <p className={`text-xs tabular-nums ${market.change > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {changeFormatter.format(market.change / 100)}
                  </p>
                </TableCell>
              </TableRow>
              );
            }) : <TableRow><TableCell colSpan={2} className="py-8 text-center text-sm text-muted-foreground">Your watchlist is empty.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
