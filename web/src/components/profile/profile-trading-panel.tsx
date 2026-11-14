"use client";

import { useId, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react/dist/ssr";
import {
  useSignAndSendTransaction,
  useSignTransaction,
  useWallets,
} from "@privy-io/react-auth/solana";
import bs58 from "bs58";
import { useBuy } from "@/hooks/use-buy";
import { useQuote } from "@/hooks/use-quote";
import { useSell } from "@/hooks/use-sell";
import type { SwapSide } from "@/hooks/market-swap-types";
import { useProfile, useUsers } from "@/hooks/use-profile";
import { execute as executeJupiterSwap } from "@/utils/jupiter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatUnits(amount: string, decimals: number) {
  const value = Number(amount) / 10 ** decimals;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.min(decimals, 6),
  }).format(value);
}

export function ProfileTradingPanel({ username }: { username: string }) {
  const [side, setSide] = useState<SwapSide>("buy");
  const [amount, setAmount] = useState("1");
  const inputId = useId();
  const { data: users } = useUsers();
  const { data: profile } = useProfile();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { signTransaction } = useSignTransaction();
  const [isSigning, setIsSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const creator = users?.users.find((user) => user.username === username);
  const numericAmount = Number(amount);
  const valid =
    amount.trim() !== "" && Number.isFinite(numericAmount) && numericAmount > 0;
  const quoteQuery = useQuote(
    side,
    creator?.token && valid
      ? { tokenMint: creator.token, amount: amount.trim() }
      : undefined,
  );
  const buy = useBuy();
  const sell = useSell();
  const mutation = side === "buy" ? buy : sell;
  const presets = side === "buy" ? [1, 5, 10] : [15, 30, 60];

  async function confirmSwap() {
    if (!creator?.token || !valid) return;
    const wallet = wallets.find(
      (candidate) => candidate.address === profile?.walletAddress,
    );
    if (!wallet) {
      setSubmissionError("Connected Privy Solana wallet not found");
      return;
    }

    setSubmissionError(null);
    setSignature(null);
    setIsSigning(true);
    try {
      const prepared = await mutation.mutateAsync({
        tokenMint: creator.token,
        amount: amount.trim(),
      });
      if (prepared.source === "jupiter") {
        const { signedTransaction } = await signTransaction({
          transaction: prepared.transaction,
          wallet,
          chain: "solana:mainnet",
        });
        setSignature(
          await executeJupiterSwap(signedTransaction, prepared.requestId),
        );
      } else {
        const { signature: txSignature } = await signAndSendTransaction({
          transaction: prepared.transaction,
          wallet,
          chain: prepared.chain,
        });
        setSignature(bs58.encode(txSignature));
      }
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "Swap submission failed",
      );
    } finally {
      setIsSigning(false);
    }
  }

  return (
    <Card className="h-fit gap-5">
      <CardContent className="space-y-6">
        <Tabs
          value={side}
          onValueChange={(value) => {
            setSide(value as SwapSide);
            setAmount(value === "buy" ? "1" : "15");
            setSignature(null);
            setSubmissionError(null);
            buy.reset();
            sell.reset();
          }}
        >
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

        <div className="space-y-2">
          <h2 className="text-xl font-medium">
            {side === "buy" ? "Buy minutes" : "Sell minutes"}
          </h2>
          <p className="text-2xl font-semibold tabular-nums">
            {quoteQuery.data
              ? `~${formatUnits(quoteQuery.data.amountOut, quoteQuery.data.outputDecimals)} ${side === "buy" ? "minutes" : "USDC"}`
              : "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            {side === "buy" ? "Spend USDC" : "Sell creator tokens"}
          </p>
        </div>

        <div className="space-y-3">
          <label htmlFor={inputId} className="sr-only">
            {side === "buy" ? "USDC to spend" : "Creator tokens to sell"}
          </label>
          <Input
            id={inputId}
            className="h-20 border-0 bg-transparent text-center text-4xl font-medium shadow-none focus-visible:ring-0 dark:bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={side === "buy" ? "1 USDC" : "15 tokens"}
            aria-invalid={amount !== "" && !valid}
          />
          <div className="grid grid-cols-3 gap-2">
            {presets.map((preset) => (
              <Button
                key={preset}
                variant="outline"
                onClick={() => setAmount(String(preset))}
              >
                {side === "buy" ? `${preset} USDC` : `${preset} min`}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {quoteQuery.isFetching && (
            <p role="status" className="text-sm text-muted-foreground">
              Fetching quote…
            </p>
          )}
          {quoteQuery.error && (
            <p role="alert" className="text-sm text-destructive">
              {quoteQuery.error.message}
            </p>
          )}
          {creator && !creator.token && (
            <p className="text-sm text-muted-foreground">
              This creator hasn’t launched a token market yet.
            </p>
          )}
          {users && !creator && (
            <p className="text-sm text-muted-foreground">
              Creator details are not available for trading.
            </p>
          )}
          {quoteQuery.data && (
            <p className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Minimum received</span>
              <span className="flex items-center gap-1 tabular-nums text-foreground">
                {side === "buy" ? (
                  <ArrowDownIcon size={14} />
                ) : (
                  <ArrowUpIcon size={14} />
                )}
                {formatUnits(
                  quoteQuery.data.minimumAmountOut,
                  quoteQuery.data.outputDecimals,
                )}
                {side === "buy" ? " min" : " USDC"}
              </span>
            </p>
          )}
          {quoteQuery.data?.source === "jupiter" && (
            <p className="text-xs text-muted-foreground">
              Routed through Jupiter after market migration.
            </p>
          )}
          {(submissionError || mutation.error) && (
            <p role="alert" className="text-sm text-destructive">
              {submissionError || mutation.error?.message}
            </p>
          )}
          {signature && (
            <p role="status" className="break-all text-sm text-emerald-400">
              Swap submitted: {signature}
            </p>
          )}
          <Button
            className="h-11 w-full text-base"
            onClick={confirmSwap}
            disabled={
              !creator?.token ||
              !valid ||
              quoteQuery.isFetching ||
              mutation.isPending ||
              isSigning
            }
          >
            {mutation.isPending || isSigning ? "Submitting…" : "Confirm"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
