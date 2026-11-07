"use client";

import { useState } from "react";
import { SortAscendingIcon, SortDescendingIcon } from "@phosphor-icons/react";
import { usePortfolioHoldings } from "@/hooks/use-portfolio";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });

export function TransactionHistory({
  isLoading = false,
}: {
  isLoading?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"asc" | "desc" | null>(null);
  const { data, isLoading: balancesLoading } = usePortfolioHoldings();
  const loading = isLoading || balancesLoading;

  const filtered = (data?.balances ?? []).filter((token) =>
    `${token.mint} ${token.name ?? ""} ${token.symbol ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  if (sort)
    filtered.sort((a, b) =>
      sort === "asc" ? a.balance - b.balance : b.balance - a.balance,
    );

  return (
    <Card className="bg-transparent ring-0">
      <CardHeader className="flex flex-wrap items-center justify-between gap-4">
        <CardTitle className="text-xl">Holdings</CardTitle>
        <Input
          aria-label="Search token"
          placeholder="Search token"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full sm:w-64"
        />
      </CardHeader>
      <CardContent>
        <Table aria-label="Holdings">
          <TableHeader className="[&_tr]:border-0">
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead>Token</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead
                className="text-right"
                aria-sort={
                  sort === "asc"
                    ? "ascending"
                    : sort === "desc"
                      ? "descending"
                      : "none"
                }
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSort(sort === "desc" ? "asc" : "desc")}
                >
                  Amount{" "}
                  {sort === "asc" ? (
                    <SortAscendingIcon aria-hidden="true" />
                  ) : (
                    <SortDescendingIcon aria-hidden="true" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 4 }, (_, index) => (
                  <TableRow key={`balance-skeleton-${index}`} className="border-0">
                    <TableCell><div className="flex items-center gap-3"><Skeleton className="size-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-12" /></div></div></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              : filtered.map((token) => (
              <TableRow
                key={token.mint}
                className="border-0 hover:bg-transparent"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={token.logoUri ?? undefined}
                        alt={`${token.name ?? token.symbol ?? "Token"} logo`}
                      />
                      <AvatarFallback>{token.symbol ?? "?"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {token.name ?? token.symbol ?? "Unknown token"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {token.symbol ?? token.mint.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {token.pricePerToken == null
                    ? "—"
                    : currency.format(token.pricePerToken)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {quantity.format(token.balance)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {token.usdValue == null
                    ? "—"
                    : currency.format(token.usdValue)}
                </TableCell>
              </TableRow>
            ))}
            {!loading && filtered.length === 0 ? (
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  No holdings found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
