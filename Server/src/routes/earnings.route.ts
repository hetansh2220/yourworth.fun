import { Hono } from "hono";
import { getEarningsChart } from "@/controllers/earnings.controller";
import { authMiddleware } from "@/middleware/authMiddleware";
import type { AppEnv } from "@/types/app";

export const earningsRoute = new Hono<AppEnv>();

earningsRoute.get("/chart", authMiddleware, getEarningsChart);
