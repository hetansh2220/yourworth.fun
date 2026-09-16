import { Hono } from "hono";
import {
  createUser,
  getMe,
  getUserByUsername,
  getUsers,
  updateUser,
} from "../controllers/users.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import type { AppEnv } from "../types/app";

export const usersRoute = new Hono<AppEnv>();

usersRoute.get("/", getUsers);
usersRoute.get("/", getUsers);
usersRoute.get("/me", authMiddleware, getMe);
usersRoute.patch("/me", authMiddleware, updateUser);
usersRoute.post("/", authMiddleware, createUser);
usersRoute.get("/:username", getUserByUsername);
