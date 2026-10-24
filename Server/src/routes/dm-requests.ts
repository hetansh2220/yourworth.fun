import { Hono } from "hono";

import { getMyDmRequests } from "../controllers/dm-requests.controller";
import { adminSignDmPayment, prepareDmPayment, submitDmPayment } from "../controllers/dm-escrow.controller";
import { prepareDmSettlementTransaction, submitDmSettlementTransaction } from "../controllers/dm-settlement.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { walletRequiredMiddleware } from "../middleware/authMiddleware";
import type { AppEnv } from "../types/app";

export const dmRequestsRoute = new Hono<AppEnv>();

dmRequestsRoute.post("/prepare", authMiddleware, walletRequiredMiddleware, prepareDmPayment);
dmRequestsRoute.post("/admin-sign", authMiddleware, walletRequiredMiddleware, adminSignDmPayment);
dmRequestsRoute.post("/submit", authMiddleware, walletRequiredMiddleware, submitDmPayment);
dmRequestsRoute.post("/:id/settlement/prepare", authMiddleware, walletRequiredMiddleware, prepareDmSettlementTransaction);
dmRequestsRoute.post("/:id/settlement/submit", authMiddleware, walletRequiredMiddleware, submitDmSettlementTransaction);
dmRequestsRoute.get("/", authMiddleware, getMyDmRequests);
