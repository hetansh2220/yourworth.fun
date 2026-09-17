import { Hono } from "hono";
import { getUserByUsername } from "./controllers/users.controller";
import { usersRoute } from "./routes/users";
import type { AppEnv } from "./types/app";
import { cors } from "hono/cors";

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: "http://localhost:3000",
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
app.get("/:username", getUserByUsername);

export default {
  port: 8080,
  fetch: app.fetch,
};
