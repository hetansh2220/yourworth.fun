"use client";

import { useState, type ReactNode } from "react";
import { ClockClockwiseIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function GroupChatDialog({ username, minutePrice, requiredMinutes = 100, minutesOwned = 0, children }: {
  username: string;
  minutePrice: number;
  requiredMinutes?: number;
  minutesOwned?: number;
  children: ReactNode;
}) {
  const [notice, setNotice] = useState(false);

  return (
    <Dialog onOpenChange={() => setNotice(false)}>
      <div className="relative rounded-xl">
        {children}
        <DialogTrigger className="absolute inset-0 cursor-pointer rounded-xl outline-none hover:bg-foreground/[0.02] focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Join ${username}'s group chat`} />
      </div>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-6 text-sm sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="min-w-0 break-words text-xl">Join {username}&apos;s group chat</DialogTitle>
            <DialogClose render={<Button variant="ghost" size="icon" className="size-9 rounded-lg border border-border text-muted-foreground hover:text-foreground" />} aria-label="Close">
              <XIcon className="size-5" aria-hidden="true" />
            </DialogClose>
          </div>
          <DialogDescription className="sr-only">Review the minutes required to join and stay in this group chat.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <dl className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Price</dt>
              <dd className="tabular-nums">Free if you hold {requiredMinutes} mins <span className="text-muted-foreground">(~${(requiredMinutes * minutePrice).toFixed(2)})</span></dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Minutes owned</dt>
              <dd className="tabular-nums">{minutesOwned.toFixed(2)} min <span className="text-muted-foreground">~ ${(minutesOwned * minutePrice).toFixed(2)}</span></dd>
            </div>
          </dl>
          <div className="flex items-start gap-3 rounded-lg border border-border p-4">
            <span className="rounded-md bg-muted p-2 text-primary"><ClockClockwiseIcon size={20} aria-hidden="true" /></span>
            <div className="space-y-1">
              <h3 className="font-medium">Maintain your subscription</h3>
              <p className="leading-relaxed text-muted-foreground">To stay in this group chat, you must maintain a minimum of {requiredMinutes} minutes of {username}&apos;s time.</p>
            </div>
          </div>
          {notice && <p role="status" className="text-sm text-muted-foreground">Group chat joining is not connected yet.</p>}
          <Button className="h-11 w-full text-base" onClick={() => setNotice(true)}>Join group chat</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
