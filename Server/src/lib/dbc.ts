import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import connection from "@/lib/connection";

const dbc = new DynamicBondingCurveClient(connection, "confirmed");

export default dbc;
