import "dotenv/config";
import { Hono } from "hono";
import { getUserByUsername } from "./controllers/users.controller";
import { usersRoute } from "./routes/users";
import { marketsRoute } from "./routes/markets";
import { chatsRoute } from "./routes/chats";
import { creatorTokensRoute } from "./routes/creator-tokens";
import { chatWebSocket, upgradeChatWebSocket } from "./lib/chat/realtime";
import { setChatServer } from "./lib/chat/pubsub";
import type { AppEnv } from "./types/app";
import { cors } from "hono/cors";

const app = new Hono<AppEnv>();
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

app.use(
  "*",
  cors({
    origin: clientOrigin,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.get("/", (c) => {
  return c.json({
    message: "API running",
  });
});

app.route("/users", usersRoute);
app.route("/markets", marketsRoute);
app.route("/chats", chatsRoute);
app.route("/creator-tokens", creatorTokensRoute);
app.get("/:username", getUserByUsername);

export default {
  port: 8080,
  async fetch(req: Request, server: Bun.Server<import("./lib/chat/realtime").ChatSocketData>) {
    setChatServer(server);
    const url = new URL(req.url);

    if (url.pathname.match(/^\/chats\/[^/]+\/ws$/)) {
      const response = await upgradeChatWebSocket(req, server);

      if (response) {
        return response;
      }

      return undefined;
    }

    return app.fetch(req);
  },
  websocket: chatWebSocket,
};
