import { strict as assert } from "assert";
import { Keypair, PublicKey } from "@solana/web3.js";
// Loaded at runtime to make a missing implementation an explicit assertion.
describe("Worth client boundaries", () => {
  let client: any;
  before(() => {
    try {
      client = require("../../client/worth");
    } catch (e) {
      client = null;
    }
    assert.ok(client, "Worth client implementation missing");
  });
  it("uses raw 32-byte orderID in both PDA namespaces", () => {
    const id = "01".repeat(32),
      program = Keypair.generate().publicKey;
    assert.ok(
      client
        .deriveOrderPda(id, program)
        .equals(
          PublicKey.findProgramAddressSync(
            [Buffer.from("order"), Buffer.alloc(32, 1)],
            program
          )[0]
        )
    );
    assert.ok(
      client
        .deriveVaultPda(id, program)
        .equals(
          PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), Buffer.alloc(32, 1)],
            program
          )[0]
        )
    );
    for (const bad of ["", "01", "zz".repeat(32), "AA".repeat(32)])
      assert.throws(() => client.decodeOrderID(bad));
  });
  it("parses token decimal amounts without precision loss", () => {
    assert.equal(client.parseTokenAmount("1.000001", 6).toString(), "1000001");
    assert.equal(
      client.parseTokenAmount("18446744073709551615", 0).toString(),
      "18446744073709551615"
    );
    for (const [amount, decimals] of [
      ["0", 6],
      ["-1", 6],
      ["1.0000001", 6],
      ["1e3", 6],
      ["18446744073709551616", 0],
    ])
      assert.throws(() => client.parseTokenAmount(amount, decimals));
  });
});
