import { Hono } from "hono";
import type { AppEnv } from "../app";
import { findAsset } from "../db/assets";
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
