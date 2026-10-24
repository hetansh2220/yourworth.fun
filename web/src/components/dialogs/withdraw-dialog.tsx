"use client";

import { useId, useState } from "react";
import { ArrowUpRightIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function WithdrawDialog() {
  const id = useId();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState("");
  const validAmount = Number.isFinite(Number(amount)) && Number(amount) > 0;

  return (
    <Dialog onOpenChange={() => setNotice("")}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <ArrowUpRightIcon aria-hidden="true" />Withdraw
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-6 text-sm sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl">Withdraw</DialogTitle>
            <DialogClose render={<Button variant="ghost" size="icon" className="size-9 rounded-lg border border-border text-muted-foreground hover:text-foreground" />} aria-label="Close">
              <XIcon className="size-5" aria-hidden="true" />
            </DialogClose>
          </div>
          <DialogDescription className="sr-only">Enter the recipient address and withdrawal amount.</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={(event) => {
          event.preventDefault();
          if (!recipient.trim() || !validAmount) return;
          setNotice("Withdrawals are not connected yet. No funds have been sent.");
        }}>
          <div className="grid gap-2">
            <label htmlFor={`${id}-recipient`} className="text-sm text-muted-foreground">Recipient address</label>
            <Input id={`${id}-recipient`} value={recipient} onChange={(event) => { setRecipient(event.target.value); setNotice(""); }} placeholder="Enter Solana address" required autoComplete="off" spellCheck={false} />
          </div>
          <div className="grid gap-2">
            <label htmlFor={`${id}-amount`} className="text-sm text-muted-foreground">Amount</label>
            <Input id={`${id}-amount`} type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(event) => { setAmount(event.target.value); setNotice(""); }} placeholder="0.00" required aria-invalid={amount !== "" && !validAmount} />
          </div>
          {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
          <Button type="submit" className="h-11 w-full text-base" disabled={!recipient.trim() || !validAmount}>Withdraw</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
