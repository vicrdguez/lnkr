import { Hono } from "hono";
import { csrf } from "hono/csrf";
import pkg from "../package.json";
import { api } from "./api";
import { requireSession } from "./auth/session";
import { ping } from "./db/schema";
import type { User } from "./db/users";
import { auth } from "./ui/auth";
import { settings } from "./ui/settings";

export type AppDeps = { sql: SqlStorage };
export type AppEnv = { Bindings: Env; Variables: { user: User; sql: SqlStorage } };

export function createApp({ sql }: AppDeps): Hono<AppEnv> {
  // strict: false makes `/api/bookmarks` and `/api/bookmarks/` one route; it must sit on the app that
  // dispatches, since sub-app options are dropped when their routes are merged by route().
  const app = new Hono<AppEnv>({ strict: false });
  app.use(async (c, next) => {
    c.set("sql", sql);
    await next();
  });
  // Mounted before the UI middleware: every /api path ends here, so csrf and requireSession never run on it.
  app.route("/api", api);
  app.use(csrf());
  app.use(requireSession);

  app.get("/health", (c) => {
    try {
      ping(sql);
      return c.json({ version: pkg.version, status: "healthy" });
    } catch {
      return c.json({ version: pkg.version, status: "unhealthy" }, 500);
    }
  });
  app.route("/", auth);
  app.route("/", settings);

  return app;
}
