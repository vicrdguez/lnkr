import { Hono } from "hono";
import type { AppEnv } from "../app";
import { requireToken } from "../auth/token";
import { assets } from "./assets";
import { bookmarks } from "./bookmarks";
import { bundles } from "./bundles";
import { profile } from "./profile";
import { notFound } from "./serialize";
import { tags } from "./tags";

/** linkding's REST API: token-authenticated, JSON only, no cookies and no CSRF. */
// Routes are registered without trailing slashes; strict: false on the root app makes both spellings match.
export const api = new Hono<AppEnv>();

api.use(requireToken);
api.route("/", bookmarks);
api.route("/", bundles);
api.route("/", assets);
api.route("/", tags);
api.route("/", profile);
api.all("*", notFound);
