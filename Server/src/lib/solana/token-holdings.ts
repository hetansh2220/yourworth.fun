import { Connection, PublicKey } from "@solana/web3.js";

const DEFAULT_SOLANA_RPC_URL = "https://api.devnet.solana.com";

function getConnection() {
  return new Connection(
    process.env.SOLANA_RPC_URL ?? DEFAULT_SOLANA_RPC_URL,
    "confirmed"
  );
}

export async function walletHoldsToken({
  walletAddress,
  mintAddress,
}: {
  walletAddress: string;
  mintAddress: string;
}) {
  const connection = getConnection();
  let owner: PublicKey;
  let mint: PublicKey;

  try {
    owner = new PublicKey(walletAddress);
    mint = new PublicKey(mintAddress);
  } catch {
    return false;
  }

  const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
    mint,
  });

  return accounts.value.some((account) => {
    const parsedAccount = account.account.data.parsed as {
      info?: {
        tokenAmount?: {
          uiAmountString?: string;
        };
      };
    };
    const amount =
      parsedAccount.info?.tokenAmount?.uiAmountString ?? "0";

    return Number(amount) > 0;
  });
}
