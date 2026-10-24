"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SparkleIcon, UserIcon } from "@phosphor-icons/react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import Image from "next/image";

const galleryPhotos = [
  "photo-1534528741775-53994a69daeb",
  "photo-1500648767791-00dcc994a43e",
  "photo-1524504388940-b1c1722653e1",
  "photo-1506794778202-cad84cf45f1d",
  "photo-1517841905240-472988babdf9",
  "photo-1519085360753-af0119f7cbe7",
  "photo-1531123897727-8f129e1688ce",
  "photo-1506794778202-cad84cf45f1d",
  "photo-1522075469751-3a6694fb2f61",
];

const photoUrl = (photo: string, width = 400) =>
  `https://images.unsplash.com/${photo}?w=${width}&auto=format&fit=crop`;

export default function Hero() {
  const { login, ready, authenticated, user } = usePrivy();
  const avatarName =
    user?.google?.name || user?.twitter?.name || user?.email?.address;

  return (
    <section
      className="relative isolate flex h-dvh flex-col overflow-hidden bg-background"
      aria-labelledby="hero-heading"
    >
      <nav
        aria-label="Main navigation"
        className="flex w-full shrink-0 items-center justify-between gap-4 bg-transparent px-4 py-4 sm:px-8"
      >
        <Link
          href="/"
          className="flex items-center text-xl font-semibold tracking-tight"
        >
          <Image
            src="/logo.png"
            alt=""
            width={48}
            height={48}
            className="size-12 rounded-md object-contain"
          />
          Worth
        </Link>
        {!ready ? (
          <div
            className="size-10 rounded-full bg-muted animate-pulse"
            aria-label="Loading account"
          />
        ) : authenticated ? (
          <Link
            href="/dashboard"
            aria-label="Open your dashboard"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Avatar className="size-10">
              {user?.twitter?.profilePictureUrl && (
                <AvatarImage src={user.twitter.profilePictureUrl} alt="" />
              )}
              <AvatarFallback className="bg-primary/15 text-primary">
                {avatarName ? (
                  avatarName.slice(0, 1).toUpperCase()
                ) : (
                  <UserIcon className="size-5" aria-hidden="true" />
                )}
              </AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Button variant="default" onClick={() => login()}>
            Login
          </Button>
        )}
      </nav>
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 sm:px-8">
        <div className="relative mx-auto max-w-3xl px-2 py-[clamp(1rem,5dvh,3.5rem)] text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-20 -z-10 h-96 rounded-full bg-primary/10 blur-[100px]"
          />
          <SparkleIcon
            aria-hidden="true"
            className="pointer-events-none absolute -left-12 top-1/3 hidden size-6 text-muted-foreground/30 lg:block"
          />
          <SparkleIcon
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 bottom-1/4 hidden size-8 text-muted-foreground/20 lg:block"
          />
          <h1
            id="hero-heading"
            className="text-balance text-4xl font-medium leading-[1.08] tracking-[-0.045em] sm:text-6xl lg:text-7xl"
          >
            Great minds.
            <br />A{" "}
            <span className="font-serif font-normal italic text-primary">
              conversation
            </span>{" "}
            away.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            <span className="block">Meet the minds that inspire you.</span>
            <span className="block">
              Turn a conversation into your next step.
            </span>
          </p>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none flex min-h-0 max-h-[45dvh] shrink-0 flex-col justify-end gap-3 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] sm:gap-4"
      >
        {[0, 1].map((row) => (
          <div
            key={row}
            className={cn(
              "flex w-max shrink-0 gap-3 sm:gap-4",
              row === 1 ? "-translate-x-20" : "-translate-x-8",
            )}
          >
            {Array.from({ length: 12 }, (_, index) => (
              <Avatar
                key={index}
                className="size-28 overflow-hidden rounded-xl after:rounded-xl sm:size-40 lg:size-44"
              >
                <AvatarImage
                  src={photoUrl(
                    galleryPhotos[(index + row * 3) % galleryPhotos.length],
                  )}
                  alt=""
                  loading="lazy"
                  className="rounded-xl"
                />
                <AvatarFallback className="rounded-xl bg-muted" />
              </Avatar>
            ))}
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[25dvh] bg-linear-to-t from-background via-background/70 to-transparent"
      />
    </section>
  );
}
