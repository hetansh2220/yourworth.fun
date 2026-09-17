import { Hono } from "hono";
import {
  createUser,
  getMe,
  getUserByUsername,
  getUsers,
  updateUser,
} from "../controllers/users.controller";
import {
  authMiddleware,
  walletRequiredMiddleware,
} from "../middleware/authMiddleware";
import type { AppEnv } from "../types/app";

export const usersRoute = new Hono<AppEnv>();

usersRoute.get("/", getUsers);
usersRoute.get("/me", authMiddleware, getMe);
usersRoute.patch("/me", authMiddleware, updateUser);
usersRoute.post("/", authMiddleware, walletRequiredMiddleware, createUser);
usersRoute.get("/:username", getUserByUsername);
