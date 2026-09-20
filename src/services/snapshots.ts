import { completeAsset, failAsset, insertAsset, newestAssetTime, refreshLatestSnapshot } from "../db/assets";
import type { BookmarkRow } from "../db/bookmarks";
import { absoluteDate } from "../lib/dates";

/** The platform's Browser Rendering limit is per account, so the rule is Tenant-wide, not per Bookmark. */
const MIN_INTERVAL_MS = 10_000;
const RENDER_TIMEOUT_MS = 60_000;

/** Both Browser Rendering secrets are set; without them the Snapshot button is hidden and the action refused. */
export const snapshotsConfigured = (env: Env): boolean => Boolean(env.CF_ACCOUNT_ID && env.CF_BROWSER_TOKEN);

/** Stored HTML is served under a sandbox so third-party markup never runs on lnkr's origin. */
export const SNAPSHOT_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "content-security-policy": "sandbox",
  "x-content-type-options": "nosniff",
  "cache-control": "private, max-age=0",
};

/**
 * Renders the Bookmark's page through Browser Rendering and stores the HTML as a new Asset, which becomes the
 * latest Snapshot. Answers the message to show instead when nothing was stored: not configured, too soon after the
 * previous Snapshot, or a render that failed, which leaves the Asset in `failure` status. No retry.
 */
export async function takeSnapshot(sql: SqlStorage, env: Env, bookmark: BookmarkRow, now: string): Promise<string | null> {
  if (!snapshotsConfigured(env)) return "Snapshots are not configured";
  // ponytail: one row read per click; a last_snapshot_at column on users.prefs is the upgrade if assets grows large.
  const previous = newestAssetTime(sql);
  if (previous && Date.parse(now) - Date.parse(previous) < MIN_INTERVAL_MS) return "Wait ten seconds between snapshots";
  const asset = insertAsset(sql, bookmark.id, `HTML snapshot from ${absoluteDate(now)}`, now);
  // ponytail: an object evicted mid-render leaves the row pending until it is deleted by hand; add a reaper when it happens.
  const size = await store(env, bookmark.url, asset.r2_key);
  // Only plain values cross the await; every row is addressed again by id.
  if (size === null) {
    failAsset(sql, asset.id);
    return "Snapshot failed";
  }
  completeAsset(sql, asset.id, size);
  refreshLatestSnapshot(sql, bookmark.id);
  return null;
}

/** Renders `url` and writes the HTML at `key`; the byte length stored, or null when either step failed. */
async function store(env: Env, url: string, key: string): Promise<number | null> {
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/content`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.CF_BROWSER_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
    });
    // The daily Browser Rendering allowance is small; the wrangler log shows what each render cost.
    console.log(`Browser Rendering ${response.status}, ${response.headers.get("x-browser-ms-used") ?? "?"} ms used`);
    const body = response.ok ? await response.json<{ success?: unknown; result?: unknown }>() : null;
    if (body?.success !== true || typeof body.result !== "string") return null;
    const bytes = new TextEncoder().encode(body.result);
    await env.ASSETS_BUCKET.put(key, bytes, { httpMetadata: { contentType: SNAPSHOT_HEADERS["content-type"] } });
    return bytes.byteLength;
  } catch {
    return null;
  }
}
