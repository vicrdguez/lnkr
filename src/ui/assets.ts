import { Hono } from "hono";
import type { AppEnv } from "../app";
import { deleteAsset, findAsset } from "../db/assets";
import { SNAPSHOT_HEADERS } from "../services/snapshots";

/** Stored Snapshots for the logged-in Tenant; the session comes from the app's middleware. */
export const assets = new Hono<AppEnv>();

const PATH = "/assets/:id{[0-9]+}";

/** The stored HTML of a complete Snapshot, sandboxed; anything else is not found. */
assets.get(PATH, async (c) => {
  const asset = findAsset(c.get("sql"), Number(c.req.param("id")));
  const object = asset?.status === "complete" ? await c.env.ASSETS_BUCKET.get(asset.r2_key) : null;
  return object ? c.body(object.body, 200, SNAPSHOT_HEADERS) : c.notFound();
});

/** Deletes the Snapshot and lands back on its Bookmark's edit page. */
assets.post(`${PATH}/delete`, async (c) => {
  const sql = c.get("sql");
  const asset = findAsset(sql, Number(c.req.param("id")));
  if (!asset) return c.notFound();
  await deleteAsset(sql, c.env.ASSETS_BUCKET, asset);
  return c.redirect(`/bookmarks/${asset.bookmark_id}/edit`);
});
