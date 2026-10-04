import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AppPrivyProvider } from "@/providers/privy-provider";
import { ProfileRedirectGuard } from "@/components/auth/profile-redirect-guard";
import { PrivyTokenDebugger } from "@/components/auth/privy-token-debugger";

export const metadata: Metadata = {
  title: "Worth",
  description: "What's your time worth?",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AppPrivyProvider>
          <QueryProvider>
            <Suspense fallback={null}>
              <ProfileRedirectGuard />
              <PrivyTokenDebugger />
            </Suspense>
            {children}
          </QueryProvider>
        </AppPrivyProvider>
      </body>
    </html>
  );
}
