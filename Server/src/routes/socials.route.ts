import { Hono } from "hono";
import { createSocials, updateSocials, getMySocials, getSocials } from "@/controllers/socials.controller";
import { authMiddleware } from "@/middleware/authMiddleware";
import type { AppEnv } from "@/types/app";

export const socialsRoute = new Hono<AppEnv>();

socialsRoute.get("/", authMiddleware, getMySocials);
socialsRoute.post("/", authMiddleware, createSocials);
socialsRoute.patch("/", authMiddleware, updateSocials);
socialsRoute.get("/:userId", getSocials);
