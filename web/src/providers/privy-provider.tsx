"use client";

import { PrivyProvider as DefaultPrivyProvider } from "@privy-io/react-auth";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

const devnetRpcUrl =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const mainnetRpcUrl =
  process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

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
        solana: {
          rpcs: {
            "solana:devnet": {
              rpc: createSolanaRpc(devnetRpcUrl),
              rpcSubscriptions: createSolanaRpcSubscriptions(
                devnetRpcUrl.replace(/^http/, "ws"),
              ),
              blockExplorerUrl: "https://explorer.solana.com/?cluster=devnet",
            },
            "solana:mainnet": {
              rpc: createSolanaRpc(mainnetRpcUrl),
              rpcSubscriptions: createSolanaRpcSubscriptions(
                mainnetRpcUrl.replace(/^http/, "ws"),
              ),
              blockExplorerUrl: "https://explorer.solana.com",
            },
          },
        },
      }}
    >
      {children}
    </DefaultPrivyProvider>
  );
}
