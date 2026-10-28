"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { getUser, type User } from "@/utils/api/users";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

const ProfileContext = createContext<User | null>(null);
const ProfileUpdateContext = createContext<((profile: User) => void) | null>(null);

export function useUpdateCurrentProfile() {
  return useContext(ProfileUpdateContext);
}

export function useCurrentProfile() {
  return useContext(ProfileContext);
}

export function ProfileRequired({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const userId = user?.id;
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready || !authenticated || !userId) return;
    let cancelled = false;
    async function checkProfile() {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Your session is unavailable. Please try again.");
        const currentProfile = await getUser(token);
        if (!cancelled) setProfile(currentProfile);
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
  }, [ready, authenticated, userId, getAccessToken, router, attempt]);

  if (ready && (!authenticated || profile !== null)) {
    return <ProfileUpdateContext.Provider value={setProfile}><ProfileContext.Provider value={authenticated ? profile : null}>{children}</ProfileContext.Provider></ProfileUpdateContext.Provider>;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <p role="status" className="text-sm text-muted-foreground">{error || "Loading your profile…"}</p>
      {error && <Button onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Try again</Button>}
    </div>
  );
}
