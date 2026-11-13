import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import connection from "./connection";

const client = new DynamicBondingCurveClient(connection, "confirmed");

export default client;
