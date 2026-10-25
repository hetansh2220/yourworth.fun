"use client";

import { useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  XLogoIcon,
  BookmarkSimpleIcon,
  StarIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ReviewDialog } from "@/components/dialogs/review-dialog";

export function ProfileActions({
  contractAddress,
  xUsername,
  reviewedUserId,
  name = "Creator",
  avatar,
}: {
  contractAddress?: string;
  xUsername?: string;
  reviewedUserId?: string;
  name?: string;
  avatar?: string;
}) {
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
  const shortAddress =
    contractAddress &&
    (contractAddress.length > 14
      ? `${contractAddress.slice(0, 6)}…${contractAddress.slice(-4)}`
      : contractAddress);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          className="rounded-lg"
          disabled={!contractAddress}
          onClick={copyAddress}
          aria-label="Copy contract address"
          title={contractAddress}
        >
          CA: {shortAddress ?? "Not available"}
          {status === "copied" ? (
            <CheckIcon aria-hidden="true" />
          ) : (
            <CopyIcon aria-hidden="true" />
          )}
        </Button>
        {xUsername ? (
          <Button
            variant="outline"
            className="size-10 rounded-lg"
            render={
              <a
                href={`https://x.com/${encodeURIComponent(xUsername.replace(/^@/, ""))}`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
            aria-label="View profile on X"
          >
            <XLogoIcon aria-hidden="true" />
          </Button>
        ) : (
          <Button
            variant="outline"
            className="size-10 rounded-lg"
            disabled
            aria-label="X profile unavailable"
          >
            <XLogoIcon aria-hidden="true" />
          </Button>
        )}
        <Button variant="outline" className="size-10 rounded-lg">
          <BookmarkSimpleIcon aria-hidden="true" />
        </Button>
        <ReviewDialog
          reviewedUserId={reviewedUserId ?? "demo-user-id"}
          name={name}
          avatar={avatar}
        >
          <Button
            variant="outline"
            className="size-10 rounded-lg"
            aria-label={`Review ${name}`}
          >
            <StarIcon aria-hidden="true" />
          </Button>
        </ReviewDialog>
      </div>
      <p
        role="status"
        className={status === "error" ? "text-xs text-destructive" : "sr-only"}
      >
        {status === "copied"
          ? "Contract address copied."
          : status === "error"
            ? "Could not copy the address. Please try again."
            : ""}
      </p>
    </div>
  );
}
