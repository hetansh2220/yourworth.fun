"use client";

import { useId, useState, type ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react";
import { BN, web3, type Wallet } from "@coral-xyz/anchor";
import {
  useSignTransaction,
  useWallets as useSolanaWallets,
} from "@privy-io/react-auth/solana";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCreateDM } from "@/hooks/use-chats";
import { useRouter } from "next/navigation";
import { createOrder } from "@/utils/solana/orders";

export function DirectMessageDialog({
  userId,
  username,
  minutePrice,
  messagePrice,
  minutesOwned = 0,
  creatorWalletAddress,
  children,
}: {
  userId: string;
  username: string;
  minutePrice: number;
  messagePrice: number;
  minutesOwned?: number;
  creatorWalletAddress?: string;
  children: ReactNode;
}) {
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const id = useId();
  const requiredMinutes =
    minutePrice > 0
      ? Math.ceil((messagePrice / minutePrice) * 100) / 100
      : null;
  const createDM = useCreateDM();
  const router = useRouter();
  const { wallets, ready: walletsReady } = useSolanaWallets();
  const { signTransaction } = useSignTransaction();

  return (
    <Dialog>
      <div className="relative rounded-xl">
        {children}
        <DialogTrigger
          className="absolute inset-0 cursor-pointer rounded-xl outline-none hover:bg-foreground/[0.02] focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Message ${username}`}
        />
      </div>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-6 text-sm sm:max-w-lg"
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="min-w-0 break-words text-xl">
              Message {username}
            </DialogTitle>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-lg border border-border text-muted-foreground hover:text-foreground"
                />
              }
              aria-label="Close"
            >
              <XIcon className="size-5" aria-hidden="true" />
            </DialogClose>
          </div>
          <DialogDescription className="sr-only">
            Compose a direct message and review the price in minutes.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!message.trim()) return;
            if (!userId) {
              setNotice("This profile is not available yet.");
              return;
            }

            const buyerWallet = wallets[0];
            if (!walletsReady || !buyerWallet) {
              setNotice("Solana wallet is not connected.");
              return;
            }
            if (!creatorWalletAddress) {
              setNotice("Creator wallet is not available yet.");
              return;
            }

            console.log("Creator wallet:", creatorWalletAddress);

            setIsSigning(true);
            try {
              let buyer: web3.PublicKey;
              let creator: web3.PublicKey;
              let mint: web3.PublicKey;
              let tokenProgram: web3.PublicKey;
              let associatedTokenProgram: web3.PublicKey;

              try {
                buyer = new web3.PublicKey(buyerWallet.address);
                creator = new web3.PublicKey(creatorWalletAddress);
                mint = new web3.PublicKey(
                  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
                );
                tokenProgram = new web3.PublicKey(
                  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                );
                associatedTokenProgram = new web3.PublicKey(
                  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
                );
              } catch {
                throw new Error("Buyer or creator wallet address is invalid");
              }
              const [source] = web3.PublicKey.findProgramAddressSync(
                [buyer.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
                associatedTokenProgram,
              );
              const orderInput = {
                admin: new web3.PublicKey(
                  "EEjBLRkRAxMUX1dmeNhBkZN7FwbfLuV5xUXmguUUCZ7r",
                ),
                buyer,
                creator,
                mint,
                source,
                orderId: crypto.getRandomValues(new Uint8Array(32)),
                amountBaseUnits: new BN(5_000_000),
                authorityEpoch: new BN(0),
                expiresAt: new BN(Math.floor(Date.now() / 1000) + 3600),
              };
              console.log("Buyer:", buyer.toBase58());
              console.log("Source ATA:", source.toBase58());
              console.log("Mint:", mint.toBase58());
              console.log("Network:", process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
              const anchorWallet = {
                publicKey: buyer,
                signTransaction: async <T,>(transaction: T) => transaction,
              } as Wallet;
              const instruction = await createOrder(anchorWallet, orderInput);
              console.log("Instruction:", instruction);
              const transaction = new web3.Transaction().add(instruction);
              transaction.feePayer = new web3.PublicKey(
                "EEjBLRkRAxMUX1dmeNhBkZN7FwbfLuV5xUXmguUUCZ7r",
              );
              const solanaConnection = new web3.Connection(
                process.env.NEXT_PUBLIC_SOLANA_RPC_URL!,
                "confirmed",
              );
              transaction.recentBlockhash = (
                await solanaConnection.getLatestBlockhash("confirmed")
              ).blockhash;
              const unsignedTransaction = transaction.serialize({
                requireAllSignatures: false,
                verifySignatures: false,
              });
              const { signedTransaction } = await signTransaction({
                transaction: unsignedTransaction,
                wallet: buyerWallet,
                chain: "solana:devnet",
              });
              const signatureId = Buffer.from(
                signedTransaction.slice(1, 65),
              ).toString("base64");
              const signedTransactionBase64 =
                Buffer.from(signedTransaction).toString("base64");
              const { chat } = await createDM.mutateAsync({
                userId,
                message: message.trim(),
                signatureId,
                signedTransaction: signedTransactionBase64,
              });
              setMessage("");
              router.push(`/chats?chatId=${encodeURIComponent(chat.id)}`);
            } catch (error) {
              setNotice(
                error instanceof Error
                  ? error.message
                  : "Could not send the message.",
              );
            } finally {
              setIsSigning(false);
            }
          }}
        >
          <div className="relative">
            <label htmlFor={id} className="sr-only">
              Message for {username}
            </label>
            <Textarea
              id={id}
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setNotice("");
              }}
              maxLength={1000}
              required
              placeholder={`Enter a message for ${username}`}
              className="min-h-36 resize-y pb-8"
              aria-describedby={`${id}-count`}
            />
            <span
              id={`${id}-count`}
              className="pointer-events-none absolute bottom-2 right-3 text-xs tabular-nums text-muted-foreground"
            >
              {message.length} / 1000
            </span>
          </div>
          <dl className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-muted-foreground">Message price</dt>
              <dd className="tabular-nums">
                {requiredMinutes === null
                  ? "—"
                  : `${requiredMinutes.toFixed(2)} min`}{" "}
                <span className="text-muted-foreground">
                  ~${messagePrice.toFixed(2)}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Minutes owned</dt>
              <dd className="tabular-nums">{minutesOwned.toFixed(2)} min</dd>
            </div>
          </dl>
          {notice && (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          )}
          <Button
            type="submit"
            className="h-11 w-full text-base"
            disabled={
              !message.trim() ||
              requiredMinutes === null ||
              createDM.isPending ||
              isSigning
            }
          >
            {isSigning
              ? "Signing…"
              : createDM.isPending
                ? "Sending…"
                : "Submit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
