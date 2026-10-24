"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppSidebar from "@/components/app-sidebar";
import { Navbar } from "@/components/navbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ProfileRequired } from "@/components/profile/profile-required";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isDashboardPage = [
    "/dashboard",
    "/earnings",
    "/explore",
    "/chats",
    "/settings",
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));

  const isProfilePage =
    pathname !== "/create-profile" &&
    /^\/[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,29}$/.test(pathname);

  if (!isDashboardPage && !isProfilePage) return <>{children}</>;

  return (
    <ProfileRequired key={pathname}>
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <Navbar />
        {children}
      </SidebarInset>
    </SidebarProvider>
    </ProfileRequired>
  );
}
