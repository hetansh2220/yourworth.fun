"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, XLogoIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function ProfileActions({ contractAddress, xUsername }: { contractAddress?: string; xUsername?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  async function copyAddress() {
    if (!contractAddress) return;
    try {
      await navigator.clipboard.writeText(contractAddress);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }
  const shortAddress = contractAddress && (contractAddress.length > 14
    ? `${contractAddress.slice(0, 6)}…${contractAddress.slice(-4)}` : contractAddress);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" className="rounded-lg" disabled={!contractAddress} onClick={copyAddress} aria-label="Copy contract address" title={contractAddress}>
          CA: {shortAddress ?? "Not available"}
          {status === "copied" ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        </Button>
        {xUsername ? (
          <Button variant="outline" className="size-10 rounded-lg" render={<a href={`https://x.com/${encodeURIComponent(xUsername.replace(/^@/, ""))}`} target="_blank" rel="noopener noreferrer" />} aria-label="View profile on X">
            <XLogoIcon aria-hidden="true" />
          </Button>
        ) : (
          <Button variant="outline" className="size-10 rounded-lg" disabled aria-label="X profile unavailable"><XLogoIcon aria-hidden="true" /></Button>
        )}
      </div>
      <p role="status" className={status === "error" ? "text-xs text-destructive" : "sr-only"}>
        {status === "copied" ? "Contract address copied." : status === "error" ? "Could not copy the address. Please try again." : ""}
      </p>
    </div>
  );
}
