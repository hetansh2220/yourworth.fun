"use client";

import { useId, useState } from "react";
import { UsersIcon, ClockIcon, CurrencyDollarIcon, PencilSimpleIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ServicePricing = { unit: "usdc" | "minutes" | "holders"; amount: number };

export function ServicePricingDialog({ type, value, onSave, triggerClassName, triggerLabel, title }: {
  type: "dms" | "group";
  value: ServicePricing;
  onSave: (value: ServicePricing) => void;
  triggerClassName?: string;
  triggerLabel?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState(value.unit);
  const [amount, setAmount] = useState(String(value.amount));
  const id = useId();
  const isGroup = type === "group";
  const options: ServicePricing["unit"][] = isGroup ? ["holders", "minutes"] : ["usdc", "minutes"];
  const valid = unit === "holders" || (Number.isFinite(Number(amount)) && Number(amount) >= (isGroup ? 1 : 0.01));

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setUnit(value.unit); setAmount(String(value.amount)); } }}>
      <DialogTrigger render={<Button variant="outline" className={triggerClassName} />}><PencilSimpleIcon aria-hidden="true" />{triggerLabel ?? "Edit"}</DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-6 sm:max-w-lg">
        <DialogHeader className="gap-2">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl">{title ?? (isGroup ? "Add group chat option" : "Edit direct message pricing")}</DialogTitle>
            <DialogClose render={<Button variant="ghost" size="icon" className="size-9 rounded-lg border border-border" />} aria-label="Close"><XIcon className="size-5" aria-hidden="true" /></DialogClose>
          </div>
          <DialogDescription className="text-sm">{isGroup ? "Choose how you want to price your group chat." : "Set your price in fixed USDC or fixed minutes."}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          onSave({ unit, amount: unit === "holders" ? 1 : Number(amount) });
          setOpen(false);
        }}>
          <fieldset className="space-y-3">
            <legend className="sr-only">Pricing option</legend>
            {options.map((option) => {
              const Icon = option === "holders" ? UsersIcon : option === "usdc" ? CurrencyDollarIcon : isGroup ? PencilSimpleIcon : ClockIcon;
              return (
                <label key={option} className={cn("relative flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-5 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring", unit === option ? "border-primary" : "border-border")}>
                  <input className="sr-only" type="radio" name={`${id}-unit`} value={option} checked={unit === option} onChange={() => { setUnit(option); setAmount(option === value.unit ? String(value.amount) : ""); }} />
                  <div className="flex items-center justify-between gap-3">
                    <Icon size={24} className={unit === option ? "text-primary" : "text-muted-foreground"} aria-hidden="true" />
                    {value.unit === option && <Badge variant="secondary" className="h-auto rounded-full px-2 py-1">Current pricing option</Badge>}
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-medium">{isGroup ? option === "holders" ? "All holders" : "Specify Minutes" : option === "usdc" ? "Fixed USDC" : "Fixed minutes"}</p>
                    <p className="text-muted-foreground">{isGroup ? option === "holders" ? "Free for minute holders that hold at least 1 minute" : "Set the minimum minutes required for users to join your group chat" : option === "usdc" ? "Set a fixed amount in USDC." : "Set a fixed number of minutes."}</p>
                  </div>
                </label>
              );
            })}
          </fieldset>
          {unit !== "holders" && <div className="grid gap-2 text-sm">
            <label htmlFor={id}>{isGroup ? "Minimum minutes to hold" : unit === "usdc" ? "Amount (USDC)" : "Amount (minutes)"}</label>
            <Input id={id} type="number" inputMode="decimal" required min={isGroup ? "1" : "0.01"} step="0.01" placeholder="Enter amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>}
          <Button type="submit" disabled={!valid} className="h-11 w-full text-base">Save changes</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
