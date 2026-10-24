"use client";

import { useId, useState, type ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function DirectMessageDialog({ username, minutePrice, messagePrice, minutesOwned = 0, children }: {
  username: string;
  minutePrice: number;
  messagePrice: number;
  minutesOwned?: number;
  children: ReactNode;
}) {
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const id = useId();
  const requiredMinutes = minutePrice > 0 ? Math.ceil(messagePrice / minutePrice * 100) / 100 : null;

  return (
    <Dialog>
      <div className="relative rounded-xl">
        {children}
        <DialogTrigger className="absolute inset-0 cursor-pointer rounded-xl outline-none hover:bg-foreground/[0.02] focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Message ${username}`} />
      </div>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-6 text-sm sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="min-w-0 break-words text-xl">Message {username}</DialogTitle>
            <DialogClose
              render={<Button variant="ghost" size="icon" className="size-9 rounded-lg border border-border text-muted-foreground hover:text-foreground" />}
              aria-label="Close"
            >
              <XIcon className="size-5" aria-hidden="true" />
            </DialogClose>
          </div>
          <DialogDescription className="sr-only">Compose a direct message and review the price in minutes.</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={(event) => {
          event.preventDefault();
          if (!message.trim()) return;
          setNotice("Messaging is not connected yet. Your message has not been sent.");
        }}>
          <div className="relative">
            <label htmlFor={id} className="sr-only">Message for {username}</label>
            <Textarea id={id} value={message} onChange={(event) => { setMessage(event.target.value); setNotice(""); }} maxLength={1000} required placeholder={`Enter a message for ${username}`} className="min-h-36 resize-y pb-8" aria-describedby={`${id}-count`} />
            <span id={`${id}-count`} className="pointer-events-none absolute bottom-2 right-3 text-xs tabular-nums text-muted-foreground">{message.length} / 1000</span>
          </div>
          <dl className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-muted-foreground">Message price</dt>
              <dd className="tabular-nums">{requiredMinutes === null ? "—" : `${requiredMinutes.toFixed(2)} min`} <span className="text-muted-foreground">~${messagePrice.toFixed(2)}</span></dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Minutes owned</dt>
              <dd className="tabular-nums">{minutesOwned.toFixed(2)} min</dd>
            </div>
          </dl>
          {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
          <Button type="submit" className="h-11 w-full text-base" disabled={!message.trim() || requiredMinutes === null}>Submit</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
