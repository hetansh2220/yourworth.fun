"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  HouseIcon,
  CardholderIcon,
  CompassIcon,
  ChatsTeardropIcon,
  UserIcon,
  MoneyIcon,
} from "@phosphor-icons/react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogoutDialog } from "@/components/dialogs/logout-dialog";
import { useCurrentProfile } from "@/components/profile/profile-required";

const groups = [
  {
    title: "Overview",
    items: [
      { title: "Home", href: "/dashboard", icon: HouseIcon },
      { title: "Earnings", href: "/earnings", icon: CardholderIcon },
      { title: "Explore", href: "/explore", icon: CompassIcon },
      { title: "Chats", href: "/chats", icon: ChatsTeardropIcon },
    ],
  },
  {
    title: "Settings",
    items: [
      { title: "Profile", href: "/settings/profile", icon: UserIcon },
      { title: "Market", href: "/settings/market", icon: MoneyIcon },
    ],
  },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const profile = useCurrentProfile();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar>
      <SidebarHeader className="h-16 shrink-0 justify-center px-7 py-0">
        <Link
          href="/"
          className="flex w-fit items-center rounded-sm text-xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setOpenMobile(false)}
        >
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="size-12 rounded-md object-contain"
          />
          Worth
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-5 px-3 pt-4">
        {groups.map((group) => (
          <SidebarGroup key={group.title} className="p-0">
            <SidebarGroupLabel className="px-4">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <nav aria-label={group.title}>
                <SidebarMenu className="gap-1">
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/" &&
                        pathname.startsWith(`${item.href}/`));

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          className="relative h-[42px] gap-3 rounded-md px-4 text-sm text-muted-foreground transition-colors hover:text-foreground data-active:bg-sidebar-accent data-active:text-foreground data-active:shadow-[inset_0_1px_1px_0_#ffffff12] before:pointer-events-none before:absolute before:inset-y-0 before:right-0 before:w-20 before:bg-linear-to-l before:from-primary/30 before:to-transparent before:opacity-0 data-active:before:opacity-100 after:pointer-events-none after:absolute after:inset-y-2 after:right-0 after:w-1 after:rounded-l-full after:bg-primary after:shadow-[0_0_16px_4px_var(--primary)] after:opacity-0  data-active:after:opacity-100 [&>svg]:relative [&>svg]:z-10 [&>svg]:size-5 [&>span]:relative [&>span]:z-10"
                          render={<Link href={item.href} />}
                          isActive={isActive}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => setOpenMobile(false)}
                        >
                          <item.icon
                            weight={isActive ? "fill" : "regular"}
                            aria-hidden="true"
                          />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-3 px-3 pb-4 pt-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <LogoutDialog />
          </SidebarMenuItem>
        </SidebarMenu>
        {profile && <Link
          href="/settings/profile"
          onClick={() => setOpenMobile(false)}
          className="flex min-w-0 items-center gap-3 rounded-md px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Avatar className="size-10 shrink-0">
            <AvatarImage
              src={profile.avatar}
              alt={profile.name}
            />
            <AvatarFallback>{(profile.name || profile.username).trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{profile.username}
            </p>
          </div>
        </Link>}
      </SidebarFooter>
    </Sidebar>
  );
}
