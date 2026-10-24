import { Hono } from "hono";
import {
  createUser,
  getMe,
  getUserByUsername,
  getUsers,
  updateUser,
  startXConnection,
  completeXConnection,
  syncWallet,
} from "../controllers/users.controller";
import { getMyPortfolio, getMyPortfolioHistory } from "../controllers/portfolio.controller";
import { getMyEarnings } from "../controllers/earnings.controller";
import {
  authMiddleware,
  walletRequiredMiddleware,
} from "../middleware/authMiddleware";
import type { AppEnv } from "../types/app";

export const usersRoute = new Hono<AppEnv>();

usersRoute.get("/", getUsers);
usersRoute.get("/me", authMiddleware, getMe);
usersRoute.get("/me/portfolio", authMiddleware, walletRequiredMiddleware, getMyPortfolio);
usersRoute.get("/me/portfolio/history", authMiddleware, walletRequiredMiddleware, getMyPortfolioHistory);
usersRoute.get("/me/earnings", authMiddleware, walletRequiredMiddleware, getMyEarnings);
usersRoute.patch("/me", authMiddleware, updateUser);
usersRoute.patch("/me/wallet", authMiddleware, syncWallet);
usersRoute.get("/x/start", authMiddleware, startXConnection);
usersRoute.get("/x/callback", completeXConnection);
usersRoute.post("/", authMiddleware, walletRequiredMiddleware, createUser);
usersRoute.get("/:username", getUserByUsername);
