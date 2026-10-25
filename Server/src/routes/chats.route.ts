import { Hono } from "hono";

import {
  chatWebSocket,
  getChatById,
  getMessages,
  getMyChats,
} from "@/controllers/chats.controller";
import { authMiddleware } from "@/middleware/authMiddleware";
import { chatMemberMiddleware } from "@/middleware/chatMiddleware";
import type { AppEnv } from "@/types/app";

export const chatsRoute = new Hono<AppEnv>();

chatsRoute.use("*", authMiddleware);
chatsRoute.get("/", getMyChats);
chatsRoute.get("/:chatId", chatMemberMiddleware, getChatById);
chatsRoute.get("/:chatId/messages", chatMemberMiddleware, getMessages);
chatsRoute.get("/:chatId/ws", chatMemberMiddleware, chatWebSocket);
