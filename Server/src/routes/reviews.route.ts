import { Hono } from "hono";
import {
  createReview,
  getReviews,
  updateReview,
} from "@/controllers/reviews.controller";
import { authMiddleware } from "@/middleware/authMiddleware";
import type { AppEnv } from "@/types/app";

export const reviewsRoute = new Hono<AppEnv>();

reviewsRoute.get("/", getReviews);
reviewsRoute.post("/", authMiddleware, createReview);
reviewsRoute.patch("/:id", authMiddleware, updateReview);
