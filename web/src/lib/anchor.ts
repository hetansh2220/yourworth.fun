import { AnchorProvider, type Wallet } from "@coral-xyz/anchor";
import connection from "./connection";

export function getAnchorProvider(wallet: Wallet): AnchorProvider {
  return new AnchorProvider(connection as never, wallet, {
    commitment: "confirmed",
  });
}

export default getAnchorProvider;
