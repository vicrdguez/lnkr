import { Hono } from "hono";
import type { AppEnv } from "../app";
import { readPrefs } from "../prefs";

/** The Tenant's own CSS, served verbatim; the layout's `?v=<hash>` link changes with it, so it may be cached long. */
export const customCss = new Hono<AppEnv>();

customCss.get("/custom_css", (c) =>
  c.body(readPrefs(c.get("user")).custom_css, 200, {
    "Content-Type": "text/css; charset=utf-8",
    "Cache-Control": "max-age=2592000",
  }),
);
