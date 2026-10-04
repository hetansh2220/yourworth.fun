import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PaidDmEscrow } from "../target/types/paid_dm_escrow";

describe("paid_dm_escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.paidDmEscrow as Program<PaidDmEscrow>;

  it("loads the paid DM escrow program client", () => {
    console.log("Program ID", program.programId.toBase58());
  });
});
