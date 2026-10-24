"use client";

import { useState } from "react";
import { SortAscendingIcon, SortDescendingIcon } from "@phosphor-icons/react";
import { tokens } from "@/components/home/crypto-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const transactions = [
  { id: "875643", token: tokens[0], amount: 200 },
  { id: "987123", token: tokens[1], amount: 30 },
  { id: "654321", token: tokens[2], amount: 500 },
  { id: "432198", token: tokens[4], amount: 100 },
];
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });
const percentage = new Intl.NumberFormat("en-US", { style: "percent", signDisplay: "always", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function TransactionHistory() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"asc" | "desc" | null>(null);
  const filtered = transactions.filter((transaction) =>
    `${transaction.id} ${transaction.token.name} ${transaction.token.symbol}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  if (sort) filtered.sort((a, b) => sort === "asc" ? a.amount - b.amount : b.amount - a.amount);

  return (
    <Card className="bg-transparent ring-0">
      <CardHeader className="flex flex-wrap items-center justify-between gap-4">
        <CardTitle className="text-xl">Holdings</CardTitle>
        <Input aria-label="Search by token name, symbol, or transaction ID" placeholder="Search token or transaction ID" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full sm:w-64" />
      </CardHeader>
      <CardContent>
        <Table aria-label="Holdings">
          <TableHeader className="[&_tr]:border-0">
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead scope="col">Token</TableHead>
              <TableHead scope="col" className="text-right">Price</TableHead>
              <TableHead scope="col" className="text-right" aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none"}>
                <Button variant="ghost" size="sm" onClick={() => setSort(sort === "desc" ? "asc" : "desc")}>
                  Amount {sort === "asc" ? <SortAscendingIcon aria-hidden="true" /> : <SortDescendingIcon aria-hidden="true" />}
                </Button>
              </TableHead>
              <TableHead scope="col" className="text-right">24h change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((transaction) => (
              <TableRow key={transaction.id} className="border-0 hover:bg-transparent">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={transaction.token.image} alt={`${transaction.token.name} logo`} />
                      <AvatarFallback>{transaction.token.symbol}</AvatarFallback>
                    </Avatar>
                    <div><p className="font-medium">{transaction.token.name}</p><p className="text-xs text-muted-foreground">{transaction.token.symbol}</p></div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{currency.format(transaction.token.price)}</TableCell>
                <TableCell className="text-right">
                  <p className="font-medium tabular-nums">{quantity.format(transaction.amount)}</p>
                </TableCell>
                <TableCell className="text-right">
                  <span className={`tabular-nums ${transaction.token.change > 0 ? "text-emerald-400" : transaction.token.change < 0 ? "text-red-400" : "text-muted-foreground"}`}>{percentage.format(transaction.token.change / 100)}</span>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? <TableRow className="border-0 hover:bg-transparent"><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No transactions found.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
