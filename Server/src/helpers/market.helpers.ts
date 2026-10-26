import type { CreatePoolParams } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { PublicKey } from "@solana/web3.js";
import { CONFIG_ADDRESS } from "@/constants";
import dbc from "@/lib/dbc";

async function launchMarket(params: Omit<CreatePoolParams, "config">) {
  await dbc.creator.createPool({
    ...params,
    config: new PublicKey(CONFIG_ADDRESS),
  });
}
