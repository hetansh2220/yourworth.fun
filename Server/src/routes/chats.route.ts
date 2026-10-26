import { Hono } from "hono";

import {
  chatWebSocket,
  createDM,
  getChatById,
  getMembers,
  getMessages,
  getMyChats,
} from "@/controllers/chats.controller";
import { authMiddleware } from "@/middleware/authMiddleware";
import { chatMemberMiddleware } from "@/middleware/chatMiddleware";
import type { AppEnv } from "@/types/app";

export const chatsRoute = new Hono<AppEnv>();

chatsRoute.get("/", authMiddleware, getMyChats);
chatsRoute.post("/dm", authMiddleware, createDM);
chatsRoute.get("/:chatId", authMiddleware, chatMemberMiddleware, getChatById);
chatsRoute.get("/members", authMiddleware, chatMemberMiddleware, getMembers);
chatsRoute.get(
  "/:chatId/messages",
  authMiddleware,
  chatMemberMiddleware,
  getMessages,
);
chatsRoute.get("/:chatId/ws", chatWebSocket);
