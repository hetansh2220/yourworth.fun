"use client";

import Link from "next/link";
import { useLogout, usePrivy } from "@privy-io/react-auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/users/use-current-user";

export default function Page() {
  const { ready, authenticated } = usePrivy();
  const { logout } = useLogout();
  const currentUserQuery = useCurrentUser();

  if (!ready) {
    return null;
  }

  if (ready && authenticated && currentUserQuery.data?.user) {
  }
  return (
    <main className="min-h-screen p-6">
      <nav className="flex items-center justify-between">
        <Link href="/" className="font-semibold">
          newtime.fun
        </Link>
        <p>Welcome, {currentUserQuery.data?.user.walletAddress}!</p>

        {ready && authenticated ? (
          <Button size="lg" onClick={() => void logout()}>
            Logout
          </Button>
        ) : (
          <Link href="/login" className={buttonVariants({ size: "lg" })}>
            Login
          </Link>
        )}
      </nav>
    </main>
  );
}
