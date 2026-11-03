import { Hono } from "hono";
import {
  createUser,
  checkUsernameAvailability,
  getMe,
  getUserByToken,
  getUsers,
  getUserBalance,
  updateUser,
  getUserBalances,
} from "@/controllers/users.controller";
import { authMiddleware } from "@/middleware/authMiddleware";
import type { AppEnv } from "@/types/app";

export const usersRoute = new Hono<AppEnv>();

usersRoute.get("/", getUsers);
usersRoute.get("/availability", checkUsernameAvailability);
usersRoute.get("/me", authMiddleware, getMe);
usersRoute.patch("/me", authMiddleware, updateUser);
usersRoute.post("/", authMiddleware, createUser);
usersRoute.get("/balance", authMiddleware, getUserBalance);
usersRoute.get("/balances", authMiddleware, getUserBalances);
usersRoute.get("/:token", getUserByToken);
