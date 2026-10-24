"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { getUser } from "@/utils/api/users";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function ProfileRequired({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const router = useRouter();
  const [verifiedId, setVerifiedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready || !authenticated || !user) return;
    let cancelled = false;
    const userId = user.id;
    async function checkProfile() {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Your session is unavailable. Please try again.");
        await getUser(token);
        if (!cancelled) setVerifiedId(userId);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          router.replace("/create-profile");
        } else {
          setError(error instanceof Error ? error.message : "Could not load your profile.");
        }
      }
    }
    void checkProfile();
    return () => { cancelled = true; };
  }, [ready, authenticated, user, getAccessToken, router, attempt]);

  if (ready && (!authenticated || (user && verifiedId === user.id))) return children;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <p role="status" className="text-sm text-muted-foreground">{error || "Loading your profile…"}</p>
      {error && <Button onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Try again</Button>}
    </div>
  );
}
