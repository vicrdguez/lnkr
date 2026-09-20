import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { type AssetRow, listAssets } from "../db/assets";
import { getBookmark } from "../db/bookmarks";
import { pageParams, paginate } from "./envelope";
import { intParam, notFound } from "./serialize";

/** linkding's asset document, keys in its order. */
const toAssetJson = (asset: AssetRow) => ({
  id: asset.id,
  bookmark: asset.bookmark_id,
  asset_type: asset.asset_type,
  date_created: asset.date_created,
  content_type: asset.content_type,
  display_name: asset.display_name,
  status: asset.status,
});

/** The Bookmark of the `id` parameter, or null. */
const bookmarkOf = (c: Context<AppEnv>) => getBookmark(c.get("sql"), intParam(c, "id"));

/** linkding's assets API under a Bookmark; token-only like the rest of `/api`. */
export const assets = new Hono<AppEnv>();

assets.get("/bookmarks/:id/assets", (c) => {
  const bookmark = bookmarkOf(c);
  if (!bookmark) return notFound(c);
  const rows = listAssets(c.get("sql"), bookmark.id);
  const page = pageParams(c);
  // ponytail: a Bookmark has a handful of Assets, so the page is cut in memory.
  return c.json(paginate(c, page, rows.length, rows.slice(page.offset, page.offset + page.limit).map(toAssetJson)));
});
