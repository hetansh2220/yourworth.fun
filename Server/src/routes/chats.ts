import { Hono } from "hono";

import {
  addGroupMember,
  createDmChat,
  createGroupChat,
  getChatById,
  getMyChats,
  markChatRead,
  removeGroupMember,
} from "../controllers/chats.controller";
import { editMessage, getMessages, removeMessage, sendMessage } from "../controllers/messages.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import {
  chatMemberMiddleware,
  groupAdminMiddleware,
} from "../middleware/chatMiddleware";
import type { AppEnv } from "../types/app";

export const chatsRoute = new Hono<AppEnv>();

chatsRoute.post("/dm", authMiddleware, createDmChat);
chatsRoute.post("/group", authMiddleware, createGroupChat);
chatsRoute.get("/", authMiddleware, getMyChats);
chatsRoute.patch("/:chatId/read", authMiddleware, chatMemberMiddleware, markChatRead);
chatsRoute.get("/:chatId", authMiddleware, chatMemberMiddleware, getChatById);
chatsRoute.get(
  "/:chatId/messages",
  authMiddleware,
  chatMemberMiddleware,
  getMessages
);
chatsRoute.post(
  "/:chatId/messages",
  authMiddleware,
  chatMemberMiddleware,
  sendMessage
);
chatsRoute.patch(
  "/:chatId/messages/:messageId",
  authMiddleware,
  chatMemberMiddleware,
  editMessage
);
chatsRoute.delete(
  "/:chatId/messages/:messageId",
  authMiddleware,
  chatMemberMiddleware,
  removeMessage
);
chatsRoute.post(
  "/:chatId/members",
  authMiddleware,
  chatMemberMiddleware,
  groupAdminMiddleware,
  addGroupMember
);
chatsRoute.delete(
  "/:chatId/members/:userId",
  authMiddleware,
  chatMemberMiddleware,
  groupAdminMiddleware,
  removeGroupMember
);
