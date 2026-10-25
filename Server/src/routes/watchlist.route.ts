import { Hono } from "hono";
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
} from "@/controllers/watchlist.controller";
import { authMiddleware } from "@/middleware/authMiddleware";
import type { AppEnv } from "@/types/app";

export const watchlistRoute = new Hono<AppEnv>();

watchlistRoute.get("/", authMiddleware, getWatchlist);
watchlistRoute.post("/", authMiddleware, addToWatchlist);
watchlistRoute.delete("/:watchedUserId", authMiddleware, removeFromWatchlist);
