import { Hono } from "hono";

import {
  getMyCreatorToken,
  launchMyCreatorToken,
} from "../controllers/creator-tokens.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import type { AppEnv } from "../types/app";

export const creatorTokensRoute = new Hono<AppEnv>();

creatorTokensRoute.get("/me", authMiddleware, getMyCreatorToken);
creatorTokensRoute.post("/me/launch", authMiddleware, launchMyCreatorToken);
