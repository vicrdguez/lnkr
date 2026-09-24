import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { getPath } from "hono/utils/url";
import pkg from "../package.json";
import { api } from "./api";
import { requireSession } from "./auth/session";
import { ping } from "./db/schema";
import type { User } from "./db/users";
import { assets } from "./ui/assets";
import { auth } from "./ui/auth";
import { bookmarkActions } from "./ui/bookmark_actions";
import { bookmarkForm } from "./ui/bookmark_form";
import { bookmarkPages } from "./ui/bookmarks";
import { bundlePages } from "./ui/bundles";
import { feeds } from "./ui/feeds";
import { settings } from "./ui/settings";

/** `transaction` runs `closure` atomically against `sql`, rolling its writes back when it throws. */
export type AppDeps = { sql: SqlStorage; transaction: <T>(closure: () => T) => T };
export type AppEnv = { Bindings: Env; Variables: { user: User } & AppDeps };

export function createApp({ sql, transaction }: AppDeps): Hono<AppEnv> {
  // Under /api a trailing slash is ignored, so `/api/bookmarks` and `/api/bookmarks/` are one route.
  // This lives on the root app because sub-app options are dropped when route() merges their routes.
  const app = new Hono<AppEnv>({ getPath: (request) => getPath(request).replace(/^(\/api\/.+)\/$/, "$1") });
  app.use(async (c, next) => {
    c.set("sql", sql);
    c.set("transaction", transaction);
    await next();
  });
  // Mounted before the UI middleware: every /api path ends here, so csrf and requireSession never run on it.
  app.route("/api", api);
  // Likewise the feeds: their token stands in for the session.
  app.route("/", feeds);
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
  app.route("/", bookmarkPages);
  app.route("/", bookmarkForm);
  app.route("/", bookmarkActions);
  app.route("/", bundlePages);
  app.route("/", assets);

  return app;
}
