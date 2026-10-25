import { Hono } from "hono";

import { getMyDmRequests } from "../controllers/dm-requests.controller";
import {
  adminSignDmPayment,
  prepareDmPayment,
  submitDmPayment,
} from "../controllers/dm-escrow.controller";
import {
  prepareDmSettlementTransaction,
  submitDmSettlementTransaction,
} from "../controllers/dm-settlement.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import type { AppEnv } from "../types/app";

export const dmRequestsRoute = new Hono<AppEnv>();

dmRequestsRoute.post("/prepare", authMiddleware, prepareDmPayment);
dmRequestsRoute.post("/admin-sign", authMiddleware, adminSignDmPayment);
dmRequestsRoute.post("/submit", authMiddleware, submitDmPayment);
dmRequestsRoute.post(
  "/:id/settlement/prepare",
  authMiddleware,
  prepareDmSettlementTransaction,
);
dmRequestsRoute.post(
  "/:id/settlement/submit",
  authMiddleware,
  submitDmSettlementTransaction,
);
dmRequestsRoute.get("/", authMiddleware, getMyDmRequests);
