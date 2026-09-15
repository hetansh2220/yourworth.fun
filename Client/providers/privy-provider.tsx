"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

export function AppPrivyProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["email"],
        appearance: {
          walletChainType: "solana-only",
        },
        embeddedWallets: {
          solana: {
            createOnLogin: "off",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
