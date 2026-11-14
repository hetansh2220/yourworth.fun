"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import AppSidebar from "@/components/app-sidebar";
import { Navbar } from "@/components/navbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ProfileRequired } from "@/components/profile/profile-required";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, authenticated } = usePrivy();

  useEffect(() => {
    if (ready && !authenticated && pathname !== "/") {
      router.replace("/");
    }
  }, [authenticated, pathname, ready, router]);

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

  if (pathname === "/") return <>{children}</>;

  if (!ready || !authenticated) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground" role="status">
          Checking your account…
        </p>
      </main>
    );
  }

  if (!isDashboardPage && !isProfilePage && pathname !== "/create-profile") {
    return <>{children}</>;
  }

  if (pathname === "/create-profile") return <>{children}</>;

  return (
    <ProfileRequired>
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
