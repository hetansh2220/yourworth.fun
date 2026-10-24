"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import Hero from "@/components/hero";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { getUser } from "@/utils/api/users";

export default function Page() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    async function checkProfile() {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Your session is unavailable. Please try again.");
        await getUser(token);
        if (!cancelled) router.replace("/dashboard");
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
  }, [ready, authenticated, getAccessToken, router, attempt]);

  if (!ready || authenticated) return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <p role="status" className="text-sm text-muted-foreground">{error || "Loading your account…"}</p>
      {error && <Button onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Try again</Button>}
    </main>
  );
  return <main><Hero /></main>;
}
