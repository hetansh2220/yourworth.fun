"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowDownLeftIcon,
  CheckIcon,
  CopyIcon,
  QrCodeIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function DepositQrCode({ address }: { address: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const host = container.current;
    import("qr-code-styling")
      .then(({ default: QRCodeStyling }) => {
        if (cancelled || !host) return;
        const qr = new QRCodeStyling({
          width: 224,
          height: 224,
          type: "svg",
          data: address,
          margin: 12,
          qrOptions: { errorCorrectionLevel: "M" },
          dotsOptions: { color: "#FFFFFF", type: "rounded" },
          backgroundOptions: { color: getComputedStyle(host).backgroundColor },
          cornersDotOptions: { color: "#FFFFFF", type: "dot" },
          cornersSquareOptions: { color: "#FFFFFF", type: "extra-rounded" },
        });
        qr.append(host);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      host?.replaceChildren();
    };
  }, [address]);

  return failed ? (
    <p role="status" className="text-sm text-muted-foreground">
      QR code unavailable. Copy the address below.
    </p>
  ) : (
    <div
      ref={container}
      role="img"
      aria-label="Solana deposit address QR code"
      className="size-56 overflow-hidden rounded-lg bg-card"
    />
  );
}

export function DepositDialog({ address }: { address?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const id = useId();
  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Dialog onOpenChange={() => setStatus("idle")}>
      <DialogTrigger render={<Button type="button" />}>
        <ArrowDownLeftIcon aria-hidden="true" />
        Deposit
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-6 text-sm sm:max-w-md"
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl">Deposit</DialogTitle>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-lg border border-border text-muted-foreground hover:text-foreground"
                />
              }
              aria-label="Close"
            >
              <XIcon className="size-5" aria-hidden="true" />
            </DialogClose>
          </div>
          <DialogDescription className="text-sm">
            Scan the QR code or copy your Solana address.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-3">
          {address ? (
            <DepositQrCode key={address} address={address} />
          ) : (
            <div className="flex size-56 flex-col items-center justify-center gap-3 rounded-lg bg-muted p-4 text-center text-muted-foreground">
              <QrCodeIcon size={40} aria-hidden="true" />
              <p>Deposit address not connected yet.</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor={id} className="text-sm text-muted-foreground">
            Solana address
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={id}
              readOnly
              value={address ?? ""}
              placeholder="Address unavailable"
              className="min-w-0 flex-1"
            />
            <Button
              variant="outline"
              className="size-10"
              aria-label="Copy Solana address"
              disabled={!address}
              onClick={copyAddress}
            >
              {status === "copied" ? (
                <CheckIcon aria-hidden="true" />
              ) : (
                <CopyIcon aria-hidden="true" />
              )}
            </Button>
          </div>
          <p
            role="status"
            className={
              status === "error" ? "text-xs text-destructive" : "sr-only"
            }
          >
            {status === "copied"
              ? "Address copied."
              : status === "error"
                ? "Could not copy the address. Please copy it from the field."
                : ""}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
