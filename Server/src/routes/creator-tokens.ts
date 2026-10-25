import { Hono } from "hono";

import {
  getMyCreatorToken,
  launchMyCreatorToken,
  prepareCreatorTokenSwap,
  submitCreatorTokenSwap,
  getCreatorTokenChart,
  settleCreatorTradingFees,
} from "../controllers/creator-tokens.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import type { AppEnv } from "../types/app";

export const creatorTokensRoute = new Hono<AppEnv>();

creatorTokensRoute.get("/chart/:username", getCreatorTokenChart);

creatorTokensRoute.get("/me", authMiddleware, getMyCreatorToken);
creatorTokensRoute.post("/me/launch", authMiddleware, launchMyCreatorToken);
creatorTokensRoute.post(
  "/fees/settle",
  authMiddleware,
  settleCreatorTradingFees,
);
creatorTokensRoute.post(
  "/swap/prepare",
  authMiddleware,
  prepareCreatorTokenSwap,
);
creatorTokensRoute.post("/swap/submit", authMiddleware, submitCreatorTokenSwap);
