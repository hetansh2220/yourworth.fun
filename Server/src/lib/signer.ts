import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const privateKey = process.env.PRIVATE_KEY?.trim();

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}

const signer = Keypair.fromSecretKey(bs58.decode(privateKey));

export default signer;
