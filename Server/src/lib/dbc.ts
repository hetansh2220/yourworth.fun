import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import connection from "./connection";

const dbc = new DynamicBondingCurveClient(connection, "confirmed");

export default dbc;
