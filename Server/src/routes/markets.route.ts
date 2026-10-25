import { Hono } from "hono";
import {
  createMarket,
  updateMarket,
  getMyMarket,
  getMarket,
} from "@/controllers/markets.controller";
import { authMiddleware } from "@/middleware/authMiddleware";
import type { AppEnv } from "@/types/app";

export const marketsRoute = new Hono<AppEnv>();

marketsRoute.get("/", authMiddleware, getMyMarket);
marketsRoute.post("/", authMiddleware, createMarket);
marketsRoute.patch("/", authMiddleware, updateMarket);
marketsRoute.get("/:id", getMarket);
