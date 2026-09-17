import type { Context, Next } from "hono";
import { privy } from "../lib/privy";
import type { AppEnv } from "../types/app";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getSolanaEmbeddedWalletAddress(linkedAccounts: unknown[]) {
  const wallet = linkedAccounts.find(
    (account) =>
      isRecord(account) &&
      account.type === "wallet" &&
      account.chain_type === "solana" &&
      account.wallet_client_type === "privy" &&
      typeof account.address === "string"
  );

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
    const claims = await privy
      .utils()
      .auth()
      .verifyAuthToken(token);

    c.set("privyUserId", claims.user_id);

    await next();
  } catch {
    return c.json({ success: false, message: "Invalid or expired token" }, 401);
  }
}

export async function walletRequiredMiddleware(c: Context<AppEnv>, next: Next) {
  try {
    const privyUserId = c.get("privyUserId");
    const privyUser = await privy.users()._get(privyUserId);
    const walletAddress = getSolanaEmbeddedWalletAddress(
      privyUser.linked_accounts
    );

    if (!walletAddress) {
      return c.json(
        { success: false, message: "Solana embedded wallet is not ready" },
        400
      );
    }

    c.set("walletAddress", walletAddress);

    await next();
  } catch {
    return c.json(
      { success: false, message: "Failed to load embedded wallet" },
      500
    );
  }
}
