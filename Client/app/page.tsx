"use client";

import Link from "next/link";
import { useLogout, usePrivy } from "@privy-io/react-auth";
import { ApiError } from "@/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/users/use-current-user";

export default function Page() {
  const { ready, authenticated } = usePrivy();
  const { logout } = useLogout();
  const currentUserQuery = useCurrentUser();
  const currentUserError = currentUserQuery.error;
  const profileMissing =
    currentUserError instanceof ApiError && currentUserError.status === 404;

  if (!ready) {
    return null;
  }

  return (
    <main className="min-h-screen p-6">
      <nav className="flex items-center justify-between gap-4">
        <Link href="/" className="font-semibold">
          Worth
        </Link>

        <div className="flex items-center gap-3">
          {authenticated && currentUserQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading profile...</p>
          ) : null}

          {authenticated && currentUserQuery.data?.user ? (
            <p className="text-sm text-muted-foreground">
              Welcome, {currentUserQuery.data.user.username}
            </p>
          ) : null}

          {authenticated && profileMissing ? (
            <Link
              href="/login?step=profile"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Complete profile
            </Link>
          ) : null}

          {authenticated && currentUserQuery.isError && !profileMissing ? (
            <p className="text-sm text-destructive">Could not load profile.</p>
          ) : null}

          {authenticated ? (
            <Button size="lg" onClick={() => void logout()}>
              Logout
            </Button>
          ) : (
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Login
            </Link>
          )}
        </div>
      </nav>
    </main>
  );
}
