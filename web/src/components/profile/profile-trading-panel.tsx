"use client";

import { useId, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ProfileTradingPanel({
  minutePrice = 0.12,
}: {
  minutePrice?: number;
}) {
  const [side, setSide] = useState("buy");
  const [unit, setUnit] = useState("minutes");
  const [amount, setAmount] = useState("1");
  const [walletNotice, setWalletNotice] = useState(false);
  const inputId = useId();
  const numericAmount = Number(amount);
  const valid =
    amount.trim() !== "" && Number.isFinite(numericAmount) && numericAmount > 0;
  const usd = unit === "usd" ? numericAmount : numericAmount * minutePrice;
  const minutes =
    unit === "minutes" ? numericAmount : numericAmount / minutePrice;

  function changeUnit(next: string) {
    if (valid && minutePrice > 0) {
      setAmount(
        (next === "usd" ? usd : minutes).toFixed(next === "usd" ? 2 : 4),
      );
    }
    setUnit(next);
  }

  return (
    <Card className="h-fit gap-5">
      <CardContent className="space-y-6">
        <Tabs value={side} onValueChange={(value) => setSide(String(value))}>
          <TabsList
            className="w-full p-[3px] group-data-horizontal/tabs:h-[52px]"
            aria-label="Trade direction"
          >
            <TabsTrigger value="buy" className="px-6 py-3 text-base">
              Buy
            </TabsTrigger>
            <TabsTrigger value="sell" className="px-6 py-3 text-base">
              Sell
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="space-y-3">
          <label htmlFor={inputId} className="sr-only">
            Amount in {unit === "usd" ? "USD" : "minutes"}
          </label>
          <div className="flex flex-col items-center gap-3">
            <Input
              id={inputId}
              className="h-24 w-full border-0 bg-transparent text-center text-5xl font-medium shadow-none focus-visible:ring-0 md:text-5xl dark:bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="1.0"
              aria-invalid={amount !== "" && !valid}
            />
            <Tabs
              value={unit}
              onValueChange={(value) => changeUnit(String(value))}
            >
              <TabsList aria-label="Amount unit">
                <TabsTrigger value="minutes" className="px-3">
                  Minutes
                </TabsTrigger>
                <TabsTrigger value="usd" className="px-3">
                  USD
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[15, 30, 60].map((preset) => (
              <Button
                key={preset}
                variant="outline"
                onClick={() => setAmount(String(preset))}
              >
                {unit === "usd" ? `$${preset}` : `${preset} min`}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Button
            className="h-11 w-full text-base"
            onClick={() => setWalletNotice(true)}
          >
            Confirm
          </Button>
          {walletNotice && (
            <p role="status" className="text-sm text-muted-foreground">
              Wallet connection is not available yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
