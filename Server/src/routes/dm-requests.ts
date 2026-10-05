import { Hono } from "hono";

import {
  createDmRequestRecord,
  getMyDmRequests,
  updateDmRequestStatus,
} from "../controllers/dm-requests.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import type { AppEnv } from "../types/app";

export const dmRequestsRoute = new Hono<AppEnv>();

dmRequestsRoute.post("/", authMiddleware, createDmRequestRecord);
dmRequestsRoute.get("/", authMiddleware, getMyDmRequests);
dmRequestsRoute.patch("/:id/status", authMiddleware, updateDmRequestStatus);
