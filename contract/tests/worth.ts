import * as anchor from "@coral-xyz/anchor";
import { strict as assert } from "assert";
import { randomBytes } from "crypto";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync,
  transfer,
  freezeAccount,
  thawAccount,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { WorthClient } from "../client/worth";
const { PublicKey, Keypair, SystemProgram, Transaction } = anchor.web3;
const LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

describe("worth escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.worth as anchor.Program;
  const payer = (provider.wallet as anchor.Wallet).payer;
  const admin = Keypair.generate(),
    buyer = Keypair.generate(),
    creator = Keypair.generate(),
    attacker = Keypair.generate();
  const config = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  )[0];
  const programData = PublicKey.findProgramAddressSync(
    [program.programId.toBuffer()],
    LOADER
  )[0];
  const client = new WorthClient(program);
  const methods = program.methods as any;
  const accounts = program.account as any;
  let mint: anchor.web3.PublicKey, source: anchor.web3.PublicKey;
  const pdas = (id: Buffer) => ({
    order: PublicKey.findProgramAddressSync(
      [Buffer.from("order"), id],
      program.programId
    )[0],
    vault: PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), id],
      program.programId
    )[0],
  });
  async function rejected(fn: () => Promise<unknown>, code?: string) {
    try {
      await fn();
    } catch (e: any) {
      if (code)
        assert.equal(
          e.error?.errorCode?.code ??
            anchor.AnchorError.parse(e.logs ?? [])?.error.errorCode.code,
          code,
          String(e)
        );
      return;
    }
    assert.fail("unauthorized/invalid transaction succeeded");
  }
  async function chainTime() {
    const clock = await provider.connection.getAccountInfo(
      anchor.web3.SYSVAR_CLOCK_PUBKEY
    );
    assert.ok(clock);
    return Number(clock.data.readBigInt64LE(32));
  }
  async function waitForExpiry(expiresAt: number) {
    const deadline = Date.now() + 30_000;
    while ((await chainTime()) < expiresAt) {
      if (Date.now() > deadline)
        throw new Error("Local validator clock did not advance");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  async function fund(
    id = randomBytes(32),
    amount = 1_000_000,
    expiry?: number
  ) {
    const expiresAt = expiry ?? (await chainTime()) + 3600;
    const p = pdas(id);
    const ix = await client.createOrder({
      orderID: id.toString("hex"),
      buyer: buyer.publicKey,
      creator: creator.publicKey,
      admin: admin.publicKey,
      mint,
      amount: new anchor.BN(amount),
      epoch: new anchor.BN(0),
      ...{ expiresAt: new anchor.BN(expiresAt) },
    });
    await provider.sendAndConfirm(new Transaction().add(ix), [admin, buyer]);
    return { id, expiresAt, ...p };
  }
  async function settle(
    p: ReturnType<typeof pdas>,
    refund = false,
    signer = refund ? buyer : creator,
    authority = admin,
    epoch = 0
  ) {
    const participant = signer;
    const destination = getAssociatedTokenAddressSync(
      mint,
      participant.publicKey
    );
    return methods[refund ? "refundOrder" : "releasePayment"](
      new anchor.BN(epoch)
    )
      .accountsStrict({
        config,
        admin: authority.publicKey,
        participant: signer.publicKey,
        mint,
        ...p,
        destination,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority, signer])
      .rpc();
  }
  before(async () => {
    await provider.sendAndConfirm(
      new Transaction().add(
        ...[admin, buyer, creator, attacker].map((k) =>
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: k.publicKey,
            lamports: 1_000_000_000,
          })
        )
      )
    );
  });
  it("only the live upgrade authority initializes config", async () => {
    assert.equal(
      typeof methods.initializeConfig,
      "function",
      "initialize_config instruction missing"
    );
    await rejected(
      () =>
        methods
          .initializeConfig(admin.publicKey)
          .accountsStrict({
            config,
            authority: attacker.publicKey,
            program: program.programId,
            programData,
            systemProgram: SystemProgram.programId,
          })
          .signers([attacker])
          .rpc(),
      "UnauthorizedUpgradeAuthority"
    );
    await rejected(() =>
      methods
        .initializeConfig(admin.publicKey)
        .accountsStrict({
          config,
          authority: payer.publicKey,
          program: program.programId,
          programData: config,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );
    const init = await client.initializeConfig(
      payer.publicKey,
      admin.publicKey
    );
    // A different fee payer prevents the transaction's fee-payer signature from masking the missing authority signature.
    const unsigned = new anchor.web3.TransactionInstruction({
      ...init,
      keys: init.keys.map((k) => ({
        ...k,
        isSigner: k.pubkey.equals(payer.publicKey) ? false : k.isSigner,
      })),
    });
    const transaction = new Transaction({
      feePayer: attacker.publicKey,
      recentBlockhash: (await provider.connection.getLatestBlockhash())
        .blockhash,
    }).add(unsigned);
    transaction.sign(attacker);
    await rejected(() =>
      provider.connection.sendRawTransaction(transaction.serialize())
    );
    await provider.sendAndConfirm(new Transaction().add(init));
    assert.equal(
      (await accounts.config.fetch(config)).admin.toBase58(),
      admin.publicKey.toBase58()
    );
    await rejected(() =>
      methods
        .initializeConfig(attacker.publicKey)
        .accountsStrict({
          config,
          authority: payer.publicKey,
          program: program.programId,
          programData,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );
  });
  it("funds an orderID vault and pays only the recorded creator once", async () => {
    mint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      6
    );
    source = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mint,
        buyer.publicKey
      )
    ).address;
    await mintTo(provider.connection, payer, mint, source, payer, 10_000_000);
    const p = await fund();
    assert.equal(
      (await getAccount(provider.connection, p.vault)).amount,
      1_000_000n
    );
    assert.deepEqual(
      Buffer.from((await accounts.order.fetch(p.order)).orderId),
      p.id
    );
    await rejected(() => fund(p.id));
    await rejected(() => settle(p, false, attacker), "WrongParticipant");
    await rejected(
      () => settle(p, false, creator, attacker),
      "UnauthorizedAdmin"
    );
    await settle(p);
    assert.equal((await getAccount(provider.connection, p.vault)).amount, 0n);
    const dest = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mint,
      creator.publicKey
    );
    assert.equal(dest.amount, 1_000_000n);
    assert.deepEqual((await accounts.order.fetch(p.order)).status, {
      paid: {},
    });
    await rejected(() => settle(p), "AlreadySettled");
    await rejected(() => settle(p, true), "AlreadySettled");
  });
  it("rejects early refunds and late payouts using the stored expiry", async () => {
    const p = await fund(randomBytes(32), 1_000_000, (await chainTime()) + 4);
    await rejected(() => settle(p, true), "OrderNotExpired");
    assert.equal(
      (await accounts.order.fetch(p.order)).expiresAt.toNumber(),
      p.expiresAt
    );
    await waitForExpiry(p.expiresAt);
    await rejected(() => settle(p), "OrderExpired");
    assert.equal(
      (await getAccount(provider.connection, p.vault)).amount,
      1_000_000n
    );
    await settle(p, true);
  });
  it("rejects past expiries atomically", async () => {
    const id = randomBytes(32);
    const before = (await getAccount(provider.connection, source)).amount;
    await rejected(() => fund(id, 1_000_000, 1), "InvalidExpiry");
    assert.equal(
      await provider.connection.getAccountInfo(pdas(id).order),
      null
    );
    assert.equal(
      (await getAccount(provider.connection, source)).amount,
      before
    );
  });
  it("refunds the exact principal to the recorded buyer once", async () => {
    const p = await fund(randomBytes(32), 1_000_000, (await chainTime()) + 3);
    await waitForExpiry(p.expiresAt);
    const before = (await getAccount(provider.connection, source)).amount;
    await settle(p, true);
    assert.equal(
      (await getAccount(provider.connection, source)).amount - before,
      1_000_000n
    );
    await rejected(() => settle(p, true), "AlreadySettled");
    await rejected(() => settle(p), "AlreadySettled");
  });
  it("checks both signers on-chain for creation, payout and refund", async () => {
    const id = randomBytes(32),
      p = pdas(id);
    const createIx = await methods
      .createOrder(
        [...id],
        new anchor.BN(1),
        new anchor.BN(0),
        new anchor.BN(4_000_000_000)
      )
      .accountsStrict({
        config,
        admin: admin.publicKey,
        buyer: buyer.publicKey,
        creator: creator.publicKey,
        mint,
        source,
        ...p,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    for (const missing of [admin, buyer]) {
      const ix = new anchor.web3.TransactionInstruction({
        ...createIx,
        keys: createIx.keys.map((k: any) => ({
          ...k,
          isSigner: k.pubkey.equals(missing.publicKey) ? false : k.isSigner,
        })),
      });
      await rejected(() =>
        provider.sendAndConfirm(new Transaction().add(ix), [
          missing === admin ? buyer : admin,
        ])
      );
    }
    assert.equal(await provider.connection.getAccountInfo(p.order), null);
    const funded = await fund(
      randomBytes(32),
      1_000_000,
      (await chainTime()) + 4
    );
    for (const refund of [false, true]) {
      if (refund) await waitForExpiry(funded.expiresAt);
      const participant = refund ? buyer : creator;
      const destination = (
        await getOrCreateAssociatedTokenAccount(
          provider.connection,
          payer,
          mint,
          participant.publicKey
        )
      ).address;
      const original = await methods[refund ? "refundOrder" : "releasePayment"](
        new anchor.BN(0)
      )
        .accountsStrict({
          config,
          admin: admin.publicKey,
          participant: participant.publicKey,
          order: funded.order,
          vault: funded.vault,
          mint,
          destination,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      for (const missing of [admin, participant]) {
        const ix = new anchor.web3.TransactionInstruction({
          ...original,
          keys: original.keys.map((k: any) => ({
            ...k,
            isSigner: k.pubkey.equals(missing.publicKey) ? false : k.isSigner,
          })),
        });
        await rejected(() =>
          provider.sendAndConfirm(new Transaction().add(ix), [
            missing === admin ? participant : admin,
          ])
        );
      }
    }
    assert.equal(
      (await getAccount(provider.connection, funded.vault)).amount,
      1_000_000n
    );
    await settle(funded, true);
  });
  it("rejects zero deposits atomically and ignores unsolicited vault tokens", async () => {
    const id = randomBytes(32);
    const pda = pdas(id);
    await rejected(
      () =>
        methods
          .createOrder(
            [...id],
            new anchor.BN(0),
            new anchor.BN(0),
            new anchor.BN(4_000_000_000)
          )
          .accountsStrict({
            config,
            admin: admin.publicKey,
            buyer: buyer.publicKey,
            creator: creator.publicKey,
            mint,
            source,
            ...pda,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin, buyer])
          .rpc(),
      "InvalidAmount"
    );
    assert.equal(
      await provider.connection.getAccountInfo(pdas(id).order),
      null
    );
    const p = await fund();
    await transfer(provider.connection, payer, source, p.vault, buyer, 7);
    await settle(p);
    assert.equal((await getAccount(provider.connection, p.vault)).amount, 7n);
  });
  it("supports a second mint with 9 decimals and rejects wrong vault/mint", async () => {
    const oldMint = mint,
      oldSource = source;
    const other = await fund(
      randomBytes(32),
      1_000_000,
      (await chainTime()) + 4
    );
    mint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      9
    );
    source = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mint,
        buyer.publicKey
      )
    ).address;
    await mintTo(provider.connection, payer, mint, source, payer, 1_000_000);
    const p = await fund(randomBytes(32), 1_000_000, (await chainTime()) + 4);
    await rejected(() => settle({ ...p, vault: other.vault }, true));
    const wrongMintDestination = getAssociatedTokenAddressSync(
      oldMint,
      buyer.publicKey
    );
    await rejected(
      () =>
        methods
          .refundOrder(new anchor.BN(0))
          .accountsStrict({
            config,
            admin: admin.publicKey,
            participant: buyer.publicKey,
            order: p.order,
            vault: p.vault,
            mint: oldMint,
            destination: wrongMintDestination,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin, buyer])
          .rpc(),
      "ConstraintHasOne"
    );
    await rejected(() => fund(other.id));
    await waitForExpiry(p.expiresAt);
    await settle(p, true);
    assert.equal(
      (await getAccount(provider.connection, source)).amount,
      1_000_000n
    );
    mint = oldMint;
    source = oldSource;
    await waitForExpiry(other.expiresAt);
    await settle(other, true);
  });
  it("retains principal if issuer freezes the vault", async () => {
    const oldMint = mint,
      oldSource = source;
    mint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
    );
    source = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mint,
        buyer.publicKey
      )
    ).address;
    await mintTo(provider.connection, payer, mint, source, payer, 1_000_000);
    const p = await fund();
    await freezeAccount(provider.connection, payer, p.vault, mint, payer);
    await rejected(() => settle(p));
    assert.deepEqual((await accounts.order.fetch(p.order)).status, {
      funded: {},
    });
    await thawAccount(provider.connection, payer, p.vault, mint, payer);
    await settle(p);
    mint = oldMint;
    source = oldSource;
  });
  for (const refund of [false, true]) {
    it(`only one of two eligible concurrent ${
      refund ? "refunds" : "payouts"
    } transfers principal`, async () => {
      const p = await fund(
        randomBytes(32),
        1_000_000,
        (await chainTime()) + (refund ? 3 : 3600)
      );
      if (refund) await waitForExpiry(p.expiresAt);
      const participant = refund ? buyer : creator;
      const destination = getAssociatedTokenAddressSync(
        mint,
        participant.publicKey
      );
      const before = (await getAccount(provider.connection, destination))
        .amount;
      const ix = await methods[refund ? "refundOrder" : "releasePayment"](
        new anchor.BN(0)
      )
        .accountsStrict({
          config,
          admin: admin.publicKey,
          participant: participant.publicKey,
          order: p.order,
          vault: p.vault,
          mint,
          destination,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      const lifetime = await provider.connection.getLatestBlockhash(
        "confirmed"
      );
      // Different compute limits produce different messages/signatures. Both transactions
      // are otherwise valid: this must not pass through duplicate-signature deduplication.
      const transactions = [200_000, 210_000].map((units) => {
        const tx = new Transaction({
          feePayer: payer.publicKey,
          recentBlockhash: lifetime.blockhash,
        }).add(
          anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units }),
          ix
        );
        tx.sign(payer, admin, participant);
        return tx;
      });
      assert.ok(!transactions[0].signature!.equals(transactions[1].signature!));
      const signatures = await Promise.all(
        transactions.map((tx) =>
          provider.connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: true,
            maxRetries: 3,
          })
        )
      );
      const results = await Promise.all(
        signatures.map((signature) =>
          provider.connection.confirmTransaction(
            { ...lifetime, signature },
            "confirmed"
          )
        )
      );
      assert.equal(
        results.filter((result) => result.value.err === null).length,
        1
      );
      const failure = results.find((result) => result.value.err !== null)!.value
        .err;
      assert.deepEqual(
        failure,
        { InstructionError: [1, { Custom: 6007 }] },
        "the losing transaction must fail with AlreadySettled, not expiry or balance errors"
      );
      assert.equal(
        (await getAccount(provider.connection, destination)).amount - before,
        1_000_000n
      );
      assert.equal((await getAccount(provider.connection, p.vault)).amount, 0n);
      assert.deepEqual(
        (await accounts.order.fetch(p.order)).status,
        refund ? { refunded: {} } : { paid: {} }
      );
    });
  }
  it("creates safely when an outsider prefunds the PDA addresses", async () => {
    const id = randomBytes(32),
      p = pdas(id);
    await provider.sendAndConfirm(
      new Transaction().add(
        ...[p.order, p.vault].map((toPubkey) =>
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey,
            lamports: 1_000_000,
          })
        )
      )
    );
    await fund(id);
    await settle(p);
  });
  it("rejects Token-2022 mints and non-independent roles", async () => {
    const mint2022 = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      6,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    const source2022 = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mint2022,
        buyer.publicKey,
        false,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
      )
    ).address;
    const id = randomBytes(32),
      p = pdas(id);
    const ac = {
      config,
      admin: admin.publicKey,
      buyer: buyer.publicKey,
      creator: creator.publicKey,
      mint,
      source,
      ...p,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    };
    await rejected(
      () =>
        methods
          .createOrder(
            [...id],
            new anchor.BN(1),
            new anchor.BN(0),
            new anchor.BN(4_000_000_000)
          )
          .accountsStrict({ ...ac, mint: mint2022, source: source2022 })
          .signers([admin, buyer])
          .rpc(),
      "AccountOwnedByWrongProgram"
    );
    await rejected(
      () =>
        methods
          .createOrder(
            [...id],
            new anchor.BN(1),
            new anchor.BN(0),
            new anchor.BN(4_000_000_000)
          )
          .accountsStrict({ ...ac, creator: buyer.publicKey })
          .signers([admin, buyer])
          .rpc(),
      "ConflictingRoles"
    );
    await rejected(
      () =>
        methods
          .createOrder(
            [...id],
            new anchor.BN(1),
            new anchor.BN(0),
            new anchor.BN(4_000_000_000)
          )
          .accountsStrict({ ...ac, creator: admin.publicKey })
          .signers([admin, buyer])
          .rpc(),
      "ConflictingRoles"
    );
    assert.equal(await provider.connection.getAccountInfo(p.order), null);
  });
  it("only upgrade authority rotates admin and old epochs cannot settle", async () => {
    const p = await fund();
    const replacement = Keypair.generate();
    const ac = {
      config,
      authority: admin.publicKey,
      program: program.programId,
      programData,
    };
    await rejected(
      () =>
        methods
          .updateAdmin(replacement.publicKey)
          .accountsStrict(ac)
          .signers([admin])
          .rpc(),
      "UnauthorizedUpgradeAuthority"
    );
    await methods
      .updateAdmin(replacement.publicKey)
      .accountsStrict({ ...ac, authority: payer.publicKey })
      .rpc();
    await rejected(() => settle(p), "UnauthorizedAdmin");
    await rejected(
      () => settle(p, false, creator, replacement, 0),
      "StaleAuthorityEpoch"
    );
    await settle(p, false, creator, replacement, 1);
    await methods
      .updateAdmin(admin.publicKey)
      .accountsStrict({ ...ac, authority: payer.publicKey })
      .rpc();
    const again = randomBytes(32);
    await rejected(() => fund(again), "StaleAuthorityEpoch");
    assert.equal(
      (await accounts.config.fetch(config)).authorityEpoch.toNumber(),
      2
    );
  });
  it("follows live upgrade-authority transfers and rejects immutable-program config changes", async () => {
    const nextAuthority = Keypair.generate();
    const transferAuthority = (
      current: anchor.web3.PublicKey,
      next?: anchor.web3.PublicKey
    ) =>
      new anchor.web3.TransactionInstruction({
        programId: LOADER,
        data: Buffer.from([4, 0, 0, 0]),
        keys: [
          { pubkey: programData, isWritable: true, isSigner: false },
          { pubkey: current, isWritable: false, isSigner: true },
          ...(next
            ? [{ pubkey: next, isWritable: false, isSigner: false }]
            : []),
        ],
      });
    await provider.sendAndConfirm(
      new Transaction().add(
        transferAuthority(payer.publicKey, nextAuthority.publicKey)
      )
    );
    const newAdmin = Keypair.generate().publicKey;
    await rejected(
      () =>
        methods
          .updateAdmin(newAdmin)
          .accountsStrict({
            config,
            authority: payer.publicKey,
            program: program.programId,
            programData,
          })
          .rpc(),
      "UnauthorizedUpgradeAuthority"
    );
    const ix = await client.updateAdmin(nextAuthority.publicKey, newAdmin);
    await provider.sendAndConfirm(new Transaction().add(ix), [nextAuthority]);
    assert.equal(
      (await accounts.config.fetch(config)).admin.toBase58(),
      newAdmin.toBase58()
    );
    await provider.sendAndConfirm(
      new Transaction().add(transferAuthority(nextAuthority.publicKey)),
      [nextAuthority]
    );
    await rejected(
      () =>
        methods
          .updateAdmin(admin.publicKey)
          .accountsStrict({
            config,
            authority: nextAuthority.publicKey,
            program: program.programId,
            programData,
          })
          .signers([nextAuthority])
          .rpc(),
      "UnauthorizedUpgradeAuthority"
    );
  });
});
