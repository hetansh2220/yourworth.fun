"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@privy-io/react-auth";
import { usePrivy } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/solana";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type WalletAccount = Extract<User["linkedAccounts"][number], { type: "wallet" }>;

function getSolanaEmbeddedWallet(user: User | null): WalletAccount | undefined {
  return user?.linkedAccounts.find(
    (account): account is WalletAccount =>
      account.type === "wallet" &&
      account.chainType === "solana" &&
      account.walletClientType === "privy"
  );
}

function getUsername(userId: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(`newtime:username:${userId}`) ?? "";
}

export default function LoginProfile() {
  const router = useRouter();
  const { ready, authenticated, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const attemptedWalletCreation = useRef(false);
  const solanaWallet = getSolanaEmbeddedWallet(user);
  const savedUsername = user ? getUsername(user.id) : "";

  useEffect(() => {
    if (savedUsername) {
      router.replace("/");
    }
  }, [router, savedUsername]);

  useEffect(() => {
    if (
      !ready ||
      !authenticated ||
      !user ||
      solanaWallet ||
      attemptedWalletCreation.current
    ) {
      return;
    }

    attemptedWalletCreation.current = true;
    createWallet().catch(() => {});
  }, [authenticated, createWallet, ready, solanaWallet, user]);

  function saveUsername() {
    const cleanUsername = username.trim();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      setError("Use 3-20 letters, numbers, or underscores.");
      return;
    }

    if (!user) {
      setError("Login first.");
      return;
    }

    window.localStorage.setItem(`newtime:username:${user.id}`, cleanUsername);
    setError("");
    router.push("/");
  }

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (!authenticated || !user) {
    return <p className="text-sm text-muted-foreground">Login first.</p>;
  }

  if (savedUsername) {
    return <p className="text-sm text-muted-foreground">Redirecting...</p>;
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        saveUsername();
      }}
    >
      <div>
        <p className="text-sm text-muted-foreground">Step 3 of 3</p>
        <h1 className="mt-1 text-2xl font-semibold">Create a username</h1>
      </div>

      <Input
        placeholder="newtime_user"
        value={username}
        onChange={(event) => {
          setUsername(event.target.value);
          setError("");
        }}
        aria-invalid={Boolean(error)}
      />

      <p className="text-sm text-muted-foreground">
        Use 3-20 letters, numbers, or underscores.
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit">Create username</Button>
    </form>
  );
}
