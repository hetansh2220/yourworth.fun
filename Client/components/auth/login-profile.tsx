"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@privy-io/react-auth";
import { usePrivy, useUser as usePrivyUser } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/solana";
import { ApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateUser } from "@/hooks/users/use-create-user";
import { useCurrentUser } from "@/hooks/users/use-current-user";
import { useUsernameAvailability } from "@/hooks/users/use-username-availability";

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
  const [debouncedUsername, setDebouncedUsername] = useState("");
  const [error, setError] = useState("");
  const [preparingWallet, setPreparingWallet] = useState(false);
  const createUserMutation = useCreateUser();
  const currentUserQuery = useCurrentUser();
  const walletCreationPromise = useRef<Promise<User> | null>(null);

  const currentUserError = currentUserQuery.error;
  const profileMissing =
    currentUserError instanceof ApiError && currentUserError.status === 404;
  const profileLoadFailed = currentUserQuery.isError && !profileMissing;
  const cleanUsername = username.trim().toLowerCase();
  const hasUsername = cleanUsername.length > 0;
  const isValidUsername = /^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername);
  const usernameAvailabilityQuery = useUsernameAvailability(
    debouncedUsername,
    isValidUsername && debouncedUsername === cleanUsername
  );
  const usernameAvailability = usernameAvailabilityQuery.data;
  const usernameCheckPending =
    hasUsername &&
    isValidUsername &&
    (debouncedUsername !== cleanUsername || usernameAvailabilityQuery.isFetching);
  const usernameAvailable =
    hasUsername &&
    isValidUsername &&
    debouncedUsername === cleanUsername &&
    usernameAvailability?.available === true;
  const usernameTaken =
    hasUsername &&
    isValidUsername &&
    debouncedUsername === cleanUsername &&
    usernameAvailability?.available === false;
  const usernameCheckFailed =
    hasUsername && isValidUsername && usernameAvailabilityQuery.isError;

  const prepareEmbeddedWallet = useCallback(async () => {
    if (getSolanaEmbeddedWallet(user)) {
      return user;
    }

    if (!user) {
      throw new Error("Login first.");
    }

    if (!walletCreationPromise.current) {
      walletCreationPromise.current = createWallet()
        .catch(async (walletError) => {
          const refreshedUser = await refreshUser();

          if (getSolanaEmbeddedWallet(refreshedUser)) {
            return refreshedUser;
          }

          throw walletError;
        })
        .then(() => refreshUser())
        .finally(() => {
          walletCreationPromise.current = null;
        });
    }

    return walletCreationPromise.current;
  }, [createWallet, refreshUser, user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedUsername(isValidUsername ? cleanUsername : "");
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [cleanUsername, isValidUsername]);

  useEffect(() => {
    if (!ready || !authenticated || !user || getSolanaEmbeddedWallet(user)) {
      return;
    }

    prepareEmbeddedWallet().catch(() => {});
  }, [authenticated, prepareEmbeddedWallet, ready, user]);

  useEffect(() => {
    if (currentUserQuery.data?.user) {
      router.replace("/");
    }
  }, [currentUserQuery.data?.user, router]);

  async function ensureWalletReady() {
    setPreparingWallet(true);

    try {
      const preparedUser = await prepareEmbeddedWallet();

      if (getSolanaEmbeddedWallet(preparedUser)) {
        return;
      }

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
    const cleanUsername = username.trim().toLowerCase();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      setError("Use 3-20 letters, numbers, or underscores.");
      return;
    }

    if (!user) {
      setError("Login first.");
      return;
    }

    if (usernameTaken) {
      setError("Username already taken.");
      return;
    }

    if (usernameCheckPending) {
      setError("Checking username. Try again in a moment.");
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

  if (!ready || (currentUserQuery.isLoading && !profileMissing)) {
    return <p className="text-sm text-white/60">Loading...</p>;
  }

  if (!authenticated || !user) {
    return <p className="text-sm text-white/60">Login first.</p>;
  }

  if (profileLoadFailed) {
    return <p className="text-sm text-destructive">Could not load profile.</p>;
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

        {!hasUsername ? (
          <p className="text-sm text-white/55">
            Use 3-20 letters, numbers, or underscores.
          </p>
        ) : !isValidUsername ? (
          <p className="text-sm text-destructive">
            Use 3-20 letters, numbers, or underscores.
          </p>
        ) : usernameCheckPending ? (
          <p className="text-sm text-white/55">Checking username...</p>
        ) : usernameAvailable ? (
          <p className="text-sm text-primary-300">Username is available.</p>
        ) : usernameTaken ? (
          <p className="text-sm text-destructive">Username is taken.</p>
        ) : usernameCheckFailed ? (
          <p className="text-sm text-destructive">Could not check username.</p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button
          type="submit"
          disabled={
            createUserMutation.isPending ||
            preparingWallet ||
            !isValidUsername ||
            usernameCheckPending ||
            usernameTaken
          }
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
