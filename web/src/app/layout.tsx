import { AppShell } from "@/components/app-shell";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import PrivyProvider from "@/providers/privy-provider";
import TanStackProvider from "@/providers/tanstack-provider";
import { CloudinaryProvider } from "@/providers/cloudinary-provider";
import { Toaster } from "@/components/ui/toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Worth",
  description: "What's your time worth?",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "dark",
        "antialiased",
        "font-sans",
        inter.variable,
      )}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <PrivyProvider>
            <TanStackProvider>
              <CloudinaryProvider>
                <Toaster>
                  <Suspense
                    fallback={
                      <div
                        className="min-h-svh bg-background"
                        role="status"
                        aria-label="Loading page"
                      />
                    }
                  >
                    <AppShell>{children}</AppShell>
                  </Suspense>
                </Toaster>
              </CloudinaryProvider>
            </TanStackProvider>
          </PrivyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
