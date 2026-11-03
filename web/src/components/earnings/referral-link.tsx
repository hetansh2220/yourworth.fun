"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/components/profile/profile-required";

export function ReferralLink() {
  const profile = useCurrentProfile();
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const referralCode = profile?.referralCode ?? "";

  async function copyLink() {
    if (!referralCode) return;
    try {
      const url = new URL("/", window.location.origin);
      url.searchParams.set("ref", referralCode);
      await navigator.clipboard.writeText(url.toString());
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copyLink}
        disabled={!referralCode}
        aria-label="Copy referral link"
      >
        {status === "copied" ? "Copied" : referralCode ? `?ref=${referralCode}` : "No referral code"}
        {status === "copied" ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      </Button>
      <span role="status" className={status === "error" ? "block text-xs text-muted-foreground" : "sr-only"}>
        {status === "copied" ? "Referral link copied." : status === "error" ? "Could not copy the link. Please try again." : ""}
      </span>
    </div>
  );
}
