import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { type AssetRow, deleteAsset, findAsset, listAssets } from "../db/assets";
import { getBookmark } from "../db/bookmarks";
import { SNAPSHOT_HEADERS } from "../services/snapshots";
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

/** The Asset `aid` of Bookmark `id`, or null when either is unknown or they do not belong together. */
function assetOf(c: Context<AppEnv>): AssetRow | null {
  const asset = findAsset(c.get("sql"), intParam(c, "aid"));
  return asset?.bookmark_id === intParam(c, "id") ? asset : null;
}

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

// Uploads of any kind are out of scope; linkding's client gets the refusal it expects.
assets.post("/bookmarks/:id/assets/upload", (c) => c.json({ detail: 'Method "POST" not allowed.' }, 405));

assets.get("/bookmarks/:id/assets/:aid", (c) => {
  const asset = assetOf(c);
  return asset ? c.json(toAssetJson(asset)) : notFound(c);
});

/** The stored file as an attachment named after the Asset; quotes and non-ASCII leave the filename. */
assets.get("/bookmarks/:id/assets/:aid/download", async (c) => {
  const asset = assetOf(c);
  const object = asset?.status === "complete" ? await c.env.ASSETS_BUCKET.get(asset.r2_key) : null;
  if (!asset || !object) return notFound(c);
  const filename = `${asset.display_name}.html`.replace(/["\\]|[^ -~]/g, "");
  return c.body(object.body, 200, { ...SNAPSHOT_HEADERS, "content-disposition": `attachment; filename="${filename}"` });
});

assets.delete("/bookmarks/:id/assets/:aid", async (c) => {
  const asset = assetOf(c);
  if (!asset) return notFound(c);
  await deleteAsset(c.get("sql"), c.env.ASSETS_BUCKET, asset);
  return c.body(null, 204);
});
