import { Hono } from "hono";
import {
  createUser,
  checkUsernameAvailability,
  getMe,
  getUsers,
  updateUser,
  searchUser,
} from "@/controllers/users.controller";
import { authMiddleware } from "@/middleware/authMiddleware";
import type { AppEnv } from "@/types/app";

export const usersRoute = new Hono<AppEnv>();

usersRoute.get("/", getUsers);
usersRoute.get("/availability", checkUsernameAvailability);
usersRoute.get("/search", searchUser);
usersRoute.get("/me", authMiddleware, getMe);
usersRoute.patch("/me", authMiddleware, updateUser);
usersRoute.post("/", authMiddleware, createUser);
