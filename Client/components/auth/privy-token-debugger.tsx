"use client";

import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";

export function PrivyTokenDebugger() {
  const { ready, authenticated, getAccessToken } = usePrivy();

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    if (!ready || !authenticated) {
      return;
    }

    let cancelled = false;

    async function logToken() {
      const token = await getAccessToken();

      if (!cancelled) {
        console.log("Privy access token:", token);
      }
    }

    logToken().catch((error) => {
      console.error("Failed to load Privy access token:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  return null;
}
