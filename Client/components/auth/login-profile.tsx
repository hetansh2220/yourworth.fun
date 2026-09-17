"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@privy-io/react-auth";
import { usePrivy, useUser as usePrivyUser } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/solana";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateUser } from "@/hooks/users/use-create-user";
import { useCurrentUser } from "@/hooks/users/use-current-user";

type WalletAccount = Extract<
  User["linkedAccounts"][number],
  { type: "wallet" }
>;

function getSolanaEmbeddedWallet(user: User | null): WalletAccount | undefined {
  return user?.linkedAccounts.find(
    (account): account is WalletAccount =>
      account.type === "wallet" &&
      account.chainType === "solana" &&
      account.walletClientType === "privy"
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not create user.";
}

function isWalletNotReadyError(message: string) {
  return message.toLowerCase().includes("wallet is not ready");
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function LoginProfile() {
  const router = useRouter();
  const { ready, authenticated, user } = usePrivy();
  const { refreshUser } = usePrivyUser();
  const { createWallet } = useCreateWallet();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [preparingWallet, setPreparingWallet] = useState(false);
  const createUserMutation = useCreateUser();
  const currentUserQuery = useCurrentUser();
  const attemptedWalletCreation = useRef(false);
  const solanaWallet = getSolanaEmbeddedWallet(user);

  useEffect(() => {
    if (currentUserQuery.data?.user) {
      router.replace("/");
    }
  }, [currentUserQuery.data?.user, router]);

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
    createWallet()
      .then(() => refreshUser())
      .catch(() => {});
  }, [authenticated, createWallet, ready, refreshUser, solanaWallet, user]);

  async function ensureWalletReady() {
    if (getSolanaEmbeddedWallet(user)) {
      return;
    }

    setPreparingWallet(true);

    try {
      await createWallet();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const refreshedUser = await refreshUser();

        if (getSolanaEmbeddedWallet(refreshedUser)) {
          return;
        }

        await wait(700);
      }
    } finally {
      setPreparingWallet(false);
    }
  }

  async function createUserWhenWalletIsReady(cleanUsername: string) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await createUserMutation.mutateAsync({ username: cleanUsername });
      } catch (createError) {
        const message = getErrorMessage(createError);

        if (!isWalletNotReadyError(message) || attempt === 3) {
          throw createError;
        }

        await refreshUser();
        await wait(900);
      }
    }
  }

  async function saveUsername() {
    const cleanUsername = username.trim();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      setError("Use 3-20 letters, numbers, or underscores.");
      return;
    }

    if (!user) {
      setError("Login first.");
      return;
    }

    try {
      setError("");

      await ensureWalletReady();
      await createUserWhenWalletIsReady(cleanUsername);
      router.replace("/");
    } catch (saveError) {
      const message = getErrorMessage(saveError);

      if (message === "User already exists") {
        router.replace("/");
        return;
      }

      setError(message);
    }
  }

  if (!ready || currentUserQuery.isLoading) {
    return <p className="text-sm text-white/60">Loading...</p>;
  }

  if (!authenticated || !user) {
    return <p className="text-sm text-white/60">Login first.</p>;
  }

  if (currentUserQuery.data?.user) {
    return <p className="text-sm text-white/60">Redirecting...</p>;
  }

  return (
    <form
      className="mx-auto grid w-full max-w-md gap-7 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        saveUsername();
      }}
    >
      <div className="grid gap-4">
        <h1 className="text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
          Create username
        </h1>
        <p className="text-base leading-snug text-white/70 sm:text-lg">
          Pick a username to finish your Worth profile.
        </p>
      </div>

      <div className="grid gap-4">
        <Input
          placeholder="worth_user"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setError("");
          }}
          aria-invalid={Boolean(error)}
        />

        <p className="text-sm text-white/55">
          Use 3-20 letters, numbers, or underscores.
        </p>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button
          type="submit"
          disabled={createUserMutation.isPending || preparingWallet}
        >
          {preparingWallet
            ? "Preparing wallet..."
            : createUserMutation.isPending
              ? "Creating..."
              : "Create username"}
        </Button>
      </div>
    </form>
  );
}
