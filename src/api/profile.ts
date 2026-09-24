import { Hono } from "hono";
import pkg from "../../package.json";
import type { AppEnv } from "../app";
import { readPrefs } from "../prefs";

export const profile = new Hono<AppEnv>();

/** linkding's profile document from the Tenant's preferences; archiving and sharing stay fixed off. */
profile.get("/user/profile", (c) => {
  const prefs = readPrefs(c.get("user"));
  return c.json({
    theme: prefs.theme,
    bookmark_date_display: prefs.bookmark_date_display,
    bookmark_link_target: prefs.bookmark_link_target,
    web_archive_integration: "disabled",
    tag_search: prefs.tag_search,
    enable_sharing: false,
    enable_public_sharing: false,
    enable_favicons: prefs.enable_favicons,
    display_url: prefs.display_url,
    permanent_notes: prefs.permanent_notes,
    search_preferences: prefs.search_preferences,
    version: pkg.version,
  });
});
