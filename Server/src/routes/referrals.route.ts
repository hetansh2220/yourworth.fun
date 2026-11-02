import { Hono } from "hono";
import { checkReferralCodeAvailability, updateReferralCode } from "@/controllers/referrals.controller";
import { authMiddleware } from "@/middleware/authMiddleware";
import type { AppEnv } from "@/types/app";

export const referralsRoute = new Hono<AppEnv>();
referralsRoute.get("/availability", checkReferralCodeAvailability);
referralsRoute.patch("/", authMiddleware, updateReferralCode);
