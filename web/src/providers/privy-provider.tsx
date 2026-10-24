"use client";

import { PrivyProvider as DefaultPrivyProvider } from "@privy-io/react-auth";

export default function PrivyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    throw new Error("Missing NEXT_PUBLIC_PRIVY_APP_ID environment variable");
  }

  return (
    <DefaultPrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        appearance: {
          theme: "dark",
          walletChainType: "solana-only",
        },
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
          solana: {
            createOnLogin: "all-users",
          },
        },
      }}
    >
      {children}
    </DefaultPrivyProvider>
  );
}
