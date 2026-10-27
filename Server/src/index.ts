import "dotenv/config";
import { Hono } from "hono";
import { getUserByToken } from "@/controllers/users.controller";
import { usersRoute } from "@/routes/users.route";
import { watchlistRoute } from "@/routes/watchlist.route";
import { reviewsRoute } from "@/routes/reviews.route";
import { marketsRoute } from "@/routes/markets.route";
import { socialsRoute } from "@/routes/socials.route";
import { chatsRoute } from "@/routes/chats.route";
import type { AppEnv } from "@/types/app";
import { cors } from "hono/cors";
import { websocket } from "@hono/bun";
import { setWebSocketServer } from "@/lib/websocket";

const app = new Hono<AppEnv>();
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

app.use(
  "*",
  cors({
    origin: clientOrigin,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/", (c) => {
  return c.json({
    message: "server is running",
  });
});

app.route("/users", usersRoute);
app.route("/watchlist", watchlistRoute);
app.route("/reviews", reviewsRoute);
app.route("/markets", marketsRoute);
app.route("/chats", chatsRoute);
app.route("/socials", socialsRoute);
app.get("/:token", getUserByToken);

export default {
  port: 8080,
  websocket,
  fetch(req: Request, server: Bun.Server<unknown>) {
    setWebSocketServer(server);
    return app.fetch(req, server);
  },
};
