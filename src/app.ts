import { Hono } from "hono";
import { csrf } from "hono/csrf";
import pkg from "../package.json";
import type { User } from "./db/users";

export type AppDeps = { sql: SqlStorage };
export type AppEnv = { Bindings: Env; Variables: { user: User; sql: SqlStorage } };

export function createApp({ sql }: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use(csrf());
  app.use(async (c, next) => {
    c.set("sql", sql);
    await next();
  });

  app.get("/health", (c) => {
    try {
      sql.exec("SELECT 1").toArray();
      return c.json({ version: pkg.version, status: "healthy" });
    } catch {
      return c.json({ version: pkg.version, status: "unhealthy" }, 500);
    }
  });

  return app;
}
