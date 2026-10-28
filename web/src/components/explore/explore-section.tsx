"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import ProfileCard from "@/components/profile/profile-card";

export type ExploreProfile = {
  username: string;
  name: string;
  bio: string;
  imageSrc: string;
  verified?: boolean;
  minutePrice: number;
  change24h: number;
};

export function ExploreSection({ id, title, description, icon, profiles }: {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  profiles: ExploreProfile[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section aria-labelledby={`${id}-heading`} className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary">{icon}</div>
          <div className="space-y-1">
            <h2 id={`${id}-heading`} className="text-xl font-medium">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button variant="outline" className="rounded-lg" aria-expanded={expanded} aria-controls={`${id}-profiles`} onClick={() => setExpanded(!expanded)}>{expanded ? "Show less" : "See all"}<CaretRightIcon aria-hidden="true" /></Button>
      </header>
      <div className="relative">
        <div id={`${id}-profiles`} className={expanded ? "grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-6 p-1" : "flex snap-x snap-mandatory gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-1 pb-3"}>
          {profiles.map((profile) => (
            <Link key={profile.username} href={`/${profile.username}`} className={`${expanded ? "min-w-0" : "w-[220px] shrink-0 snap-start sm:w-[240px]"} rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary`} aria-label={`View ${profile.name}'s profile`}>
              <ProfileCard {...profile} className="h-full" />
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
}
