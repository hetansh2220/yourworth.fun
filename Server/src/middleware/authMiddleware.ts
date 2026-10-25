import type { Context, Next } from "hono";
import privy from "../lib/privy";
import type { AppEnv } from "../types/app";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getSolanaEmbeddedWalletAddress(
  linkedAccounts: unknown[],
  preferredAddress?: string,
) {
  const wallets = linkedAccounts.filter(
    (account) =>
      isRecord(account) &&
      account.type === "wallet" &&
      account.chain_type === "solana" &&
      account.wallet_client_type === "privy" &&
      typeof account.address === "string",
  );
  const wallet =
    wallets.find(
      (account) => isRecord(account) && account.address === preferredAddress,
    ) ?? wallets[0];

  return isRecord(wallet) && typeof wallet.address === "string"
    ? wallet.address
    : "";
}

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ success: false, message: "Unauthorized" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const claims = await privy.utils().auth().verifyAccessToken(token);

    const user = await privy.users()._get(claims.user_id);
    const walletAddress = getSolanaEmbeddedWalletAddress(user.linked_accounts);
    if (!walletAddress) {
      return c.json(
        { success: false, message: "Solana embedded wallet is not ready" },
        400,
      );
    }
    c.set("walletAddress", walletAddress);
  } catch {
    return c.json({ success: false, message: "Invalid or expired token" }, 401);
  }

  await next();
}
