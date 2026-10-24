"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CardholderIcon,
  CompassIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  ChatsTeardropIcon,
  UserIcon,
  MoneyIcon,
} from "@phosphor-icons/react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const pageTitles: Record<string, string> = {
  dashboard: "Dashboard",
  earnings: "Earnings",
  explore: "Explore",
  chats: "Chats",
  settings: "Settings",
};

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const section = pathname.split("/")[1] || "home";
  const title = pageTitles[section] ?? "Worth";
  const PageIcon =
    section === "earnings"
      ? CardholderIcon
      : section === "explore"
        ? CompassIcon
        : HouseIcon;

  if (!["/dashboard", "/earnings", "/explore"].includes(pathname)) return null;

  return (
    <header className="sticky top-0 z-30 mb-4 grid h-16 shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-b bg-background px-4 md:grid-cols-[1fr_minmax(0,24rem)_1fr]">
      <Breadcrumb>
        <BreadcrumbList className="gap-2 text-sm">
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link href="/dashboard" />}
              className="inline-flex items-center gap-2"
            >
              <PageIcon className="size-5" aria-hidden="true" />
              Overview
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div role="search" className="relative w-full">
        <MagnifyingGlassIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <button
          type="button"
          aria-label="Search"
          aria-haspopup="dialog"
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen(true)}
          className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-left text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Search…
        </button>
      </div>
      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Search Worth"
        description="Search pages and navigate around Worth."
      >
        <Command>
          <CommandInput autoFocus placeholder="Search pages…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Pages">
              {[
                { label: "Home", icon: HouseIcon, href: "/dashboard" },
                { label: "Earnings", icon: CardholderIcon, href: "/earnings" },
                { label: "Explore", icon: CompassIcon, href: "/explore" },
                { label: "Chats", icon: ChatsTeardropIcon, href: "/chats" },
                { label: "Profile", icon: UserIcon, href: "/settings/profile" },
                { label: "Market", icon: MoneyIcon, href: "/settings/market" },
              ].map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.label}
                  onSelect={() => {
                    setSearchOpen(false);
                    router.push(item.href);
                  }}
                >
                  <item.icon aria-hidden="true" className="size-5" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </header>
  );
}
