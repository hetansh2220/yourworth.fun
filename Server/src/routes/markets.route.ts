import { Hono } from "hono";
import {
  createMarket,
  getMarket,
  getMarkets,
  getMyMarket,
  updateMarket,
} from "@/controllers/markets.controller";
import { authMiddleware } from "@/middleware/authMiddleware";
import type { AppEnv } from "@/types/app";

export const marketsRoute = new Hono<AppEnv>();

marketsRoute.get("/", getMarkets);
marketsRoute.get("/me", authMiddleware, getMyMarket);
marketsRoute.post("/", authMiddleware, createMarket);
marketsRoute.patch("/me", authMiddleware, updateMarket);
marketsRoute.get("/:id", getMarket);
