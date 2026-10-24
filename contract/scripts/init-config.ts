import * as anchor from "@coral-xyz/anchor";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const programId = new PublicKey(
  process.env.WORTH_PROGRAM_ID ?? "FBYUHStkYfQ9i9ZwVVFB6yXN2iQUGbnQ5aFoxYbYWLCz",
);
const authorityPath =
  process.env.UPGRADE_AUTHORITY_KEYPAIR ??
  resolve(homedir(), ".config/solana/id.json");
const adminAddress = process.env.ADMIN_PUBLIC_KEY;
const configuredIdlPath = process.env.WORTH_IDL_PATH ?? "target/idl/worth.json";
const idlPath = resolve(
  configuredIdlPath
    .replace(/^\$PWD(?=\/)/, process.cwd())
    .replace(/^\$HOME(?=\/)/, homedir())
    .replace(/^~(?=\/)/, homedir()),
);

if (!adminAddress) {
  throw new Error(
    "BACKEND_ADMIN_PUBLIC_KEY is required. Set it to the public key of the separate backend admin wallet.",
  );
}

const expandedAuthorityPath = authorityPath
  .replace(/^\$HOME(?=\/)/, homedir())
  .replace(/^~(?=\/)/, homedir());
const authority = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(resolve(expandedAuthorityPath), "utf8"))),
);
const admin = new PublicKey(adminAddress);
const idl = JSON.parse(readFileSync(idlPath, "utf8")) as anchor.Idl;
const connection = new Connection(rpcUrl, "confirmed");
const provider = new anchor.AnchorProvider(
  connection,
  new anchor.Wallet(authority),
  { commitment: "confirmed" },
);
const program = new anchor.Program(idl, provider);
const [config] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  programId,
);
const programData = PublicKey.findProgramAddressSync(
  [programId.toBuffer()],
  new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
)[0];

async function main() {
  const existing = await connection.getAccountInfo(config);
  if (existing) {
    console.log(`Config already initialized: ${config.toBase58()}`);
    return;
  }

const instruction = await program.methods
  .initializeConfig(admin)
  .accountsStrict({
    config,
    authority: authority.publicKey,
    program: programId,
    programData,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .instruction();

const signature = await sendAndConfirmTransaction(
  connection,
  new Transaction().add(instruction),
  [authority],
  { commitment: "confirmed" },
);

  console.log(`Config initialized: ${config.toBase58()}`);
  console.log(`Admin: ${admin.toBase58()}`);
  console.log(`Signature: ${signature}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
