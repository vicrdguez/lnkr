import { Hono } from "hono";
import pkg from "../../package.json";
import type { AppEnv } from "../app";

export const profile = new Hono<AppEnv>();

/** linkding's profile document with fixed defaults; nothing here is configurable yet. */
profile.get("/user/profile", (c) =>
  c.json({
    theme: "auto",
    bookmark_date_display: "relative",
    bookmark_link_target: "_blank",
    web_archive_integration: "disabled",
    tag_search: "strict",
    enable_sharing: false,
    enable_public_sharing: false,
    enable_favicons: false,
    display_url: false,
    permanent_notes: false,
    search_preferences: { sort: "added_desc", shared: "off", unread: "off" },
    version: pkg.version,
  }),
);
