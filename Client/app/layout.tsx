import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AppPrivyProvider } from "@/providers/privy-provider";

export const metadata: Metadata = {
  title: "newtime.fun",
  description: "Privy auth with embedded wallets",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppPrivyProvider>
          <QueryProvider>{children}</QueryProvider>
        </AppPrivyProvider>
      </body>
    </html>
  );
}
