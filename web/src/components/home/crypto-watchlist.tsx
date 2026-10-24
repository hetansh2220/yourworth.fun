import { tokens } from "@/components/home/crypto-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";



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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Watchlist</CardTitle>
      </CardHeader>
      <CardContent>
        <Table aria-label="Watchlist" className="border-separate border-spacing-0">
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.symbol} className="border-0 hover:bg-transparent hover:[&>td]:bg-muted/50">
                <TableCell className="rounded-l-md">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={token.image} alt={`${token.name} logo`} />
                      <AvatarFallback>{token.symbol}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{token.name}</p>
                      <p className="text-xs text-muted-foreground">{token.symbol}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="rounded-r-md text-right">
                  <p className="font-medium tabular-nums">{priceFormatter.format(token.price)}</p>
                  <p className={`text-xs tabular-nums ${token.change > 0 ? "text-emerald-400" : token.change < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                    {changeFormatter.format(token.change / 100)}
                  </p>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
