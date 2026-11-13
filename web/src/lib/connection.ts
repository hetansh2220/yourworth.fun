import { Connection } from "@solana/web3.js";

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL!,
  "confirmed",
);

export default connection;
