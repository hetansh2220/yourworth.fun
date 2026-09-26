import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AppPrivyProvider } from "@/providers/privy-provider";
import { ProfileRedirectGuard } from "@/components/auth/profile-redirect-guard";

export const metadata: Metadata = {
  title: "Worth",
  description: "What's your time worth?",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppPrivyProvider>
          <QueryProvider>
            <Suspense fallback={null}>
              <ProfileRedirectGuard />
            </Suspense>
            {children}
          </QueryProvider>
        </AppPrivyProvider>
      </body>
    </html>
  );
}
