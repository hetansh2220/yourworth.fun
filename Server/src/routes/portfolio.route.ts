import { Hono } from "hono";
import {
  getHoldings,
  getPortfolioBalance,
  getPortfolioStats,
  getWalletBalanceChart,
} from "@/controllers/portfolio.controller";
import { authMiddleware } from "@/middleware/authMiddleware";
import type { AppEnv } from "@/types/app";

export const portfolioRoute = new Hono<AppEnv>();

portfolioRoute.get("/balance", authMiddleware, getPortfolioBalance);
portfolioRoute.get("/holdings", authMiddleware, getHoldings);
portfolioRoute.get("/stats", authMiddleware, getPortfolioStats);
portfolioRoute.get("/chart", authMiddleware, getWalletBalanceChart);
