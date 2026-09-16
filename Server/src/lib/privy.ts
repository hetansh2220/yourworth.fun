import "dotenv/config";
import { PrivyClient } from "@privy-io/node";

const appId = process.env.PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

if (!appId || !appSecret) {
  throw new Error(
    "Missing Privy server env vars. Add PRIVY_APP_ID and PRIVY_APP_SECRET to Server/.env."
  );
}

export const privy = new PrivyClient({
  appId,
  appSecret,
});
