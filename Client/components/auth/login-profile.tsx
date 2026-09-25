"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@privy-io/react-auth";
import { usePrivy, useUser as usePrivyUser } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/solana";
import { Camera } from "lucide-react";
import { ApiError } from "@/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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

function LoginProfileSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-sm gap-7">
      <div className="grid justify-items-center gap-3">
        <Skeleton className="h-12 w-64 bg-white/10" />
        <Skeleton className="h-4 w-48 bg-white/10" />
      </div>

      <div className="grid justify-items-center gap-3">
        <Skeleton className="size-28 rounded-full bg-white/10" />
        <Skeleton className="h-4 w-36 bg-white/10" />
      </div>

      <div className="grid gap-5">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-32 bg-white/10" />
          <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
          <Skeleton className="h-4 w-56 bg-white/10" />
        </div>

        <div className="grid gap-2">
          <Skeleton className="h-4 w-12 bg-white/10" />
          <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
          <Skeleton className="h-4 w-24 bg-white/10" />
        </div>

        <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}

function isWalletNotReadyError(message: string) {
  return message.toLowerCase().includes("wallet is not ready");
}

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_MAX_DIMENSION = 800;
const AVATAR_QUALITY = 0.82;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Could not read avatar image."));
    };

    image.src = imageUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function getCompressedAvatarName(fileName: string, type: string) {
  const extension = type === "image/webp" ? "webp" : "jpg";
  const baseName = fileName.replace(/\.[^/.]+$/, "") || "avatar";

  return `${baseName}.${extension}`;
}

async function compressAvatarFile(file: File) {
  if (!AVATAR_TYPES.has(file.type)) {
    throw new Error("Upload a PNG, JPG, or WebP image.");
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error("Avatar must be smaller than 5MB.");
  }

  const image = await loadImage(file);
  const scale = Math.min(
    AVATAR_MAX_DIMENSION / image.naturalWidth,
    AVATAR_MAX_DIMENSION / image.naturalHeight,
    1
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  if (scale === 1 && file.size <= 512 * 1024) {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not optimize avatar image.");
  }

  context.drawImage(image, 0, 0, width, height);

  const blob =
    (await canvasToBlob(canvas, "image/webp", AVATAR_QUALITY)) ??
    (await canvasToBlob(canvas, "image/jpeg", 0.86));

  if (!blob) {
    throw new Error("Could not optimize avatar image.");
  }

  return new File([blob], getCompressedAvatarName(file.name, blob.type), {
    type: blob.type,
    lastModified: Date.now(),
  });
}

export default function LoginProfile() {
  const router = useRouter();
  const { ready, authenticated, user } = usePrivy();
  const { refreshUser } = usePrivyUser();
  const { createWallet } = useCreateWallet();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [debouncedUsername, setDebouncedUsername] = useState("");
  const [error, setError] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [optimizingAvatar, setOptimizingAvatar] = useState(false);
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
    return () => {
      if (avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

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

  async function createUserWhenWalletIsReady(
    cleanUsername: string,
    avatar: File,
    cleanBio: string
  ) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await createUserMutation.mutateAsync({
          username: cleanUsername,
          avatar,
          bio: cleanBio,
        });
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

  async function selectAvatar(file: File) {
    setError("");
    setOptimizingAvatar(true);

    try {
      const optimizedAvatar = await compressAvatarFile(file);

      setAvatarFile(optimizedAvatar);
      setAvatarPreview(URL.createObjectURL(optimizedAvatar));
    } catch (avatarError) {
      setAvatarFile(null);
      setAvatarPreview("");
      setError(getErrorMessage(avatarError));
    } finally {
      setOptimizingAvatar(false);
    }
  }

  async function saveUsername() {
    const cleanUsername = username.trim().toLowerCase();
    const cleanBio = bio.trim();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      setError("Use 3-20 letters, numbers, or underscores.");
      return;
    }

    if (!user) {
      setError("Login first.");
      return;
    }

    if (cleanBio.length < 1 || cleanBio.length > 160) {
      setError("Bio must be 1-160 characters.");
      return;
    }

    if (!avatarFile) {
      setError("Upload your avatar.");
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

    if (usernameCheckFailed) {
      setError("Could not check username. Try again.");
      return;
    }

    if (!usernameAvailable) {
      setError("Choose an available username.");
      return;
    }

    try {
      setError("");

      await ensureWalletReady();
      await createUserWhenWalletIsReady(cleanUsername, avatarFile, cleanBio);
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

  const checkingProfile =
    !ready ||
    !authenticated ||
    !user ||
    (currentUserQuery.isLoading && !profileMissing) ||
    (currentUserQuery.isFetching && !profileMissing);

  if (checkingProfile || currentUserQuery.data?.user) {
    return <LoginProfileSkeleton />;
  }

  if (profileLoadFailed) {
    return <p className="text-sm text-destructive">Could not load profile.</p>;
  }

  return (
    <form
      className="mx-auto grid w-full max-w-sm gap-7 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        saveUsername();
      }}
    >
      <div className="grid gap-2 text-center">
        <h1 className="text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
          Create profile
        </h1>
        <p className="text-sm leading-snug text-white/55">
          Add your avatar, username, and bio.
        </p>
      </div>

      <div className="grid justify-items-center gap-3">
        <label
          className="group relative cursor-pointer rounded-full focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background"
          aria-label="Upload avatar"
        >
          <Avatar className="size-28 border border-white/10 bg-white/10">
            {avatarPreview ? (
              <AvatarImage src={avatarPreview} alt="Selected avatar" />
            ) : null}
            <AvatarFallback className="bg-white/10 text-sm font-medium text-white/45">
              Avatar
            </AvatarFallback>
          </Avatar>

          <span className="absolute inset-x-0 bottom-0 flex h-9 items-center justify-center rounded-b-full bg-black/60 text-white opacity-100 transition group-hover:bg-black/70">
            <Camera className="size-4" aria-hidden="true" />
          </span>

          <Input
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={optimizingAvatar}
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void selectAvatar(file);
              }

              event.target.value = "";
            }}
          />
        </label>

        <p className="text-center text-sm text-white/55">
          {optimizingAvatar
            ? "Optimizing avatar..."
            : avatarFile
              ? "Avatar selected"
              : "Click to upload avatar"}
        </p>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-2">
          <p className="text-sm font-medium text-white">Create username</p>
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
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-medium text-white">Bio</p>
          <Input
            placeholder="Short bio"
            value={bio}
            maxLength={160}
            onChange={(event) => {
              setBio(event.target.value);
              setError("");
            }}
            aria-invalid={Boolean(error)}
          />
          <p className="text-sm text-white/55">
            {bio.trim().length}/160 characters.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button
          type="submit"
          disabled={
            createUserMutation.isPending ||
            preparingWallet ||
            optimizingAvatar ||
            !avatarFile ||
            bio.trim().length < 1 ||
            bio.trim().length > 160 ||
            !isValidUsername ||
            usernameCheckPending ||
            usernameCheckFailed ||
            !usernameAvailable ||
            usernameTaken
          }
        >
          {optimizingAvatar
            ? "Optimizing..."
            : preparingWallet
              ? "Preparing wallet..."
              : createUserMutation.isPending
                ? "Creating..."
                : "Submit"}
        </Button>
      </div>
    </form>
  );
}
