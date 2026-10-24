"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function ReferralLink() {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copyLink() {
    try {
      const url = new URL("/", window.location.origin);
      url.searchParams.set("ref", "harsh");
      await navigator.clipboard.writeText(url.toString());
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" size="sm" onClick={copyLink} aria-label="Copy referral link">
        {status === "copied" ? "Copied" : "?ref=harsh"}
        {status === "copied" ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      </Button>
      <span role="status" className={status === "error" ? "block text-xs text-muted-foreground" : "sr-only"}>
        {status === "copied" ? "Referral link copied." : status === "error" ? "Could not copy the link. Please try again." : ""}
      </span>
    </div>
  );
}
