import connection from "@/lib/connection";
import signer from "@/lib/signer";
import { BorshInstructionCoder, type Idl } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { PROGRAM_ID } from "@/constants";
import idl from "@/constants/idl.json";

const programId = new PublicKey(PROGRAM_ID);
const coder = new BorshInstructionCoder(idl as Idl);

const [config] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  programId,
);

export enum PaymentTransactionType {
  REQUEST = "REQUEST",
  REFUND = "REFUND",
  PAYOUT = "PAYOUT",
}

const paymentInstructions = {
  [PaymentTransactionType.REQUEST]: "create_order",
  [PaymentTransactionType.REFUND]: "refund_order",
  [PaymentTransactionType.PAYOUT]: "release_payment",
} as const;

/** Verifies the instruction type and signatures, not payment terms or on-chain execution. */
export function verifySignedTransaction(
  signedTx: string,
  type: PaymentTransactionType,
): boolean {
  try {
    if (
      !signedTx ||
      signedTx.length > 1644 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        signedTx,
      )
    )
      return false;

    const transaction = Transaction.from(Buffer.from(signedTx, "base64"));
    if (!transaction.verifySignatures(false)) return false;

    const instruction = transaction.instructions[0];
    if (
      transaction.instructions.length !== 1 ||
      !instruction?.programId.equals(programId)
    )
      return false;

    const expectedName = paymentInstructions[type];
    const decoded = coder.decode(instruction.data);
    if (!expectedName || decoded?.name !== expectedName) return false;
    const definition = idl.instructions.find(
      (item) => item.name === expectedName,
    );
    if (!definition || instruction.keys.length !== definition.accounts.length)
      return false;

    const requiredSigners = definition.accounts.flatMap((expected, index) => {
      const actual = instruction.keys[index];
      return "signer" in expected && expected.signer && actual
        ? [actual.pubkey]
        : [];
    });
    if (
      requiredSigners.length !== 2 ||
      requiredSigners[0]!.equals(requiredSigners[1]!)
    )
      return false;
    if (!requiredSigners[0]!.equals(signer.publicKey)) return false;
    if (transaction.signatures.length !== requiredSigners.length) return false;
    if (!transaction.feePayer?.equals(signer.publicKey)) return false;
    if (!instruction.keys[0]?.pubkey.equals(config)) return false;

    return (
      definition.accounts.every((expected, index) => {
        const actual = instruction.keys[index];
        if (!actual) return false;
        if ("signer" in expected && expected.signer && !actual.isSigner)
          return false;
        if ("writable" in expected && expected.writable && !actual.isWritable)
          return false;
        if (
          "address" in expected &&
          typeof expected.address === "string" &&
          !actual.pubkey.equals(new PublicKey(expected.address))
        )
          return false;
        return true;
      }) &&
      requiredSigners.every((key) =>
        transaction.signatures.some(
          (signature) =>
            signature.publicKey.equals(key) &&
            (key.equals(signer.publicKey) || signature.signature !== null),
        ),
      )
    );
  } catch {
    return false;
  }
}

/** Call only after validating the transaction and its payment details. */
export async function signAndSendTransaction(
  base64Tx: string,
): Promise<string> {
  const tx = Transaction.from(Buffer.from(base64Tx, "base64"));
  tx.partialSign(signer);

  return connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
}
