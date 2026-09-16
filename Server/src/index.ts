import { Hono } from "hono";
import { usersRoute } from "./routes/users";
import type { AppEnv } from "./types/app";

const app = new Hono<AppEnv>();

app.get("/", (c) => {
  return c.json({
    message: "API running",
  });
});

app.route("/users", usersRoute);

export default {
  port: 8080,
  fetch: app.fetch,
};