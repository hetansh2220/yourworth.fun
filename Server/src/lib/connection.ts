import { Connection } from "@solana/web3.js";

if (!process.env.SOLANA_RPC_URL) {
  throw new Error("Missing SOLANA_RPC_URL env var");
}

const connection = new Connection(process.env.SOLANA_RPC_URL, "confirmed");

export default connection;
