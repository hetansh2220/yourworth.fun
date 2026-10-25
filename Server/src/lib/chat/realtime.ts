import type { ServerWebSocket } from "bun";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import { users } from "../../db/schema";
import {
  createChatMessage,
  deleteChatMessage,
  messageContentSchema,
  updateChatMessageContent,
} from "./messages";
import {
  getMessageRateLimitKey,
  getTypingRateLimitKey,
  isRateLimited,
} from "./rate-limit";
import { getChatTopic } from "./pubsub";
import { getMessageOwner, hasChatAccess, isTransientNetworkError } from "./chat-helpers";
import { canDeleteMessage, canEditMessage, canSendDmMessage } from "./message-permissions";
import { privy } from "../privy";
import { getSolanaEmbeddedWalletAddress } from "../../middleware/authMiddleware";

export type ChatSocketData = {
  chatId: string;
  userId: string;
  chatAdminId: string;
};

const incomingMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ping") }),
  z.object({
    type: z.literal("message"),
    content: messageContentSchema,
  }),
  z.object({
    type: z.literal("message.edit"),
    messageId: z.string().uuid(),
    content: messageContentSchema,
  }),
  z.object({
    type: z.literal("message.delete"),
    messageId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("typing.start"),
  }),
  z.object({
    type: z.literal("typing.stop"),
  }),
]);


function getToken(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "");
  }

  const protocol = req.headers.get("sec-websocket-protocol");
  const tokenProtocol = protocol
    ?.split(",")
    .map((value) => value.trim())
    .find((value) => value.startsWith("privy-token."));

  return tokenProtocol?.replace("privy-token.", "") ?? "";
}

async function getCurrentUserFromToken(token: string) {
  const claims = await privy
    .utils()
    .auth()
    .verifyAccessToken(token);

  const privyUser = await privy.users()._get(claims.user_id);
  const walletAddress = getSolanaEmbeddedWalletAddress(privyUser.linked_accounts);
  if (!walletAddress) return undefined;

  const [user] = await db
    .select({ id: users.id, walletAddress: users.address })
    .from(users)
    .where(eq(users.address, walletAddress))
    .limit(1);

  return user;
}

function sendError(ws: ServerWebSocket<ChatSocketData>, message: string) {
  ws.send(
    JSON.stringify({
      type: "error",
      message,
    })
  );
}

export async function upgradeChatWebSocket(
  req: Request,
  server: Bun.Server<ChatSocketData>
) {
  const url = new URL(req.url);
  const chatId = url.pathname.match(/^\/chats\/([^/]+)\/ws$/)?.[1];
  const parsedChatId = z.string().uuid().safeParse(chatId);

  if (!parsedChatId.success) {
    return new Response("Chat id is invalid", { status: 400 });
  }

  const token = getToken(req);

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const user = await getCurrentUserFromToken(token);

    if (!user) {
      return new Response("Create your user profile first", { status: 404 });
    }

    const access = await hasChatAccess(parsedChatId.data, user.id, user.walletAddress);

    if (!access) {
      return new Response("Chat not found", { status: 404 });
    }

    const upgraded = server.upgrade(req, {
      data: {
        chatId: parsedChatId.data,
        userId: user.id,
        chatAdminId: access.chatAdminId,
      },
    });

    if (upgraded) {
      return undefined;
    }

    return new Response("WebSocket upgrade failed", { status: 400 });
  } catch (error) {
    console.error("Chat websocket upgrade error:", error);
    return new Response(
      isTransientNetworkError(error) ? "Chat service temporarily unavailable" : "Invalid or expired token",
      { status: isTransientNetworkError(error) ? 503 : 401 },
    );
  }
}

export const chatWebSocket = {
  open(ws: ServerWebSocket<ChatSocketData>) {
    ws.subscribe(getChatTopic(ws.data.chatId));
    ws.send(
      JSON.stringify({
        type: "connected",
        chatId: ws.data.chatId,
      })
    );
  },

  async message(ws: ServerWebSocket<ChatSocketData>, rawMessage: string | Buffer) {
    try {
      const parsedJson = JSON.parse(rawMessage.toString()) as unknown;
      const parsedMessage = incomingMessageSchema.safeParse(parsedJson);

      if (!parsedMessage.success) {
        sendError(
          ws,
          parsedMessage.error.issues[0]?.message ?? "Invalid message"
        );
        return;
      }

      if (parsedMessage.data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (
        parsedMessage.data.type === "typing.start" ||
        parsedMessage.data.type === "typing.stop"
      ) {
        if (
          isRateLimited(getTypingRateLimitKey(ws.data.chatId, ws.data.userId), {
            limit: 20,
            windowMs: 10_000,
          })
        ) {
          return;
        }

        ws.publish(
          getChatTopic(ws.data.chatId),
          JSON.stringify({
            type: parsedMessage.data.type,
            chatId: ws.data.chatId,
            userId: ws.data.userId,
          })
        );
        return;
      }

      if (
        isRateLimited(getMessageRateLimitKey(ws.data.chatId, ws.data.userId), {
          limit: 20,
          windowMs: 10_000,
        })
      ) {
        sendError(ws, "You are sending messages too quickly");
        return;
      }

      if (parsedMessage.data.type === "message") {
        if (!(await canSendDmMessage(ws.data.chatId, ws.data.userId))) {
          sendError(ws, "Paid DM messages must be sent through the creator's DM dialog");
          return;
        }

        const message = await createChatMessage(
          ws.data.chatId,
          ws.data.userId,
          parsedMessage.data.content.trim()
        );

        const payload = JSON.stringify({
          type: "message.created",
          message,
        });

        ws.publish(getChatTopic(ws.data.chatId), payload);
        ws.send(payload);
        return;
      }

      const existingMessage = await getMessageOwner(
        parsedMessage.data.messageId,
        ws.data.chatId
      );

      if (!existingMessage) {
        sendError(ws, "Message not found");
        return;
      }

      if (parsedMessage.data.type === "message.edit") {
        if (!canEditMessage(existingMessage, ws.data.userId)) {
          sendError(ws, "You can only edit your own messages");
          return;
        }

        if (existingMessage.deletedAt) {
          sendError(ws, "Deleted messages cannot be edited");
          return;
        }

        const message = await updateChatMessageContent(
          ws.data.chatId,
          parsedMessage.data.messageId,
          parsedMessage.data.content.trim()
        );

        const payload = JSON.stringify({
          type: "message.updated",
          message,
        });

        ws.publish(getChatTopic(ws.data.chatId), payload);
        ws.send(payload);
        return;
      }

      if (!canDeleteMessage(existingMessage, ws.data.userId, ws.data.chatAdminId)) {
        sendError(ws, "You cannot delete this message");
        return;
      }

      const message = await deleteChatMessage(
        ws.data.chatId,
        parsedMessage.data.messageId
      );

      const payload = JSON.stringify({
        type: "message.deleted",
        message,
      });

      ws.publish(getChatTopic(ws.data.chatId), payload);
      ws.send(payload);
    } catch (error) {
      console.error("Chat websocket message error:", error);
      sendError(ws, "Failed to handle chat event");
    }
  },

  close(ws: ServerWebSocket<ChatSocketData>) {
    ws.unsubscribe(getChatTopic(ws.data.chatId));
  },
};
