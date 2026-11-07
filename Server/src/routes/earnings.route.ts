import { Hono } from "hono";
import {
  getEarnings,
  getEarningsChart,
  getSpenders,
} from "@/controllers/earnings.controller";
import { authMiddleware } from "@/middleware/authMiddleware";
import type { AppEnv } from "@/types/app";

export const earningsRoute = new Hono<AppEnv>();

earningsRoute.get("/", authMiddleware, getEarnings);
earningsRoute.get("/chart", authMiddleware, getEarningsChart);
earningsRoute.get("/spenders", authMiddleware, getSpenders);
