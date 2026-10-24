import { Hono } from "hono";
import {
  createUser,
  checkUsernameAvailability,
  getMe,
  getUserByToken,
  getUsers,
  updateUser,
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
usersRoute.get("/availability", checkUsernameAvailability);
usersRoute.get("/me", authMiddleware, getMe);
usersRoute.get("/me/portfolio", authMiddleware, walletRequiredMiddleware, getMyPortfolio);
usersRoute.get("/me/portfolio/history", authMiddleware, walletRequiredMiddleware, getMyPortfolioHistory);
usersRoute.get("/me/earnings", authMiddleware, walletRequiredMiddleware, getMyEarnings);
usersRoute.patch("/me", authMiddleware, updateUser);
usersRoute.post("/", authMiddleware, createUser);
usersRoute.get("/:token", getUserByToken);
