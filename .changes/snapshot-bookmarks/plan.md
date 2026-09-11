# Snapshot bookmarks Plan

## Approach
One new service, `src/services/snapshots.ts`, owns the whole Snapshot lifecycle: rate check, pending row, Browser Rendering call, R2 write, row update, latest pointer. The list item action, the edit page and the assets API are thin callers of it. Stored HTML is served through the app with a sandboxing policy so third-party markup never runs on lnkr's origin. Project layout, SQL access, timestamps, sessions, tokens and the test harness follow `.changes/stand-up-tenant/plan.md`; the Datastar SSE conventions follow `.changes/act-on-bookmarks-ui/plan.md`.

## Implementation decisions

- **Migration 4** (M1 ends at version 2 and serve-feeds-and-tokens adds version 3; renumber if that one has not merged yet, the version is the array index plus one):
  ```sql
  CREATE TABLE assets (
    id INTEGER PRIMARY KEY,
    bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id),
    asset_type TEXT NOT NULL DEFAULT 'snapshot',
    content_type TEXT NOT NULL,
    display_name TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('pending', 'complete', 'failure')),
    date_created TEXT NOT NULL
  );
  CREATE INDEX assets_bookmark ON assets(bookmark_id, date_created);
  ALTER TABLE bookmarks ADD COLUMN latest_snapshot_id INTEGER REFERENCES assets(id);
  ```
  Foreign keys are documentation only, as everywhere in the schema: the code deletes `assets` rows and clears `latest_snapshot_id` explicitly and never relies on `PRAGMA foreign_keys`.
- **Bindings.** `wrangler.jsonc` gains `r2_buckets: [{ binding: "ASSETS_BUCKET", bucket_name: "lnkr-assets" }]`. Secrets `CF_ACCOUNT_ID` and `CF_BROWSER_TOKEN` come from `wrangler secret` in production and `.dev.vars` locally; `vitest.config.ts` sets them through `cloudflareTest({ miniflare: { bindings: { CF_ACCOUNT_ID: "acc", CF_BROWSER_TOKEN: "tok" } } })`. `wrangler types` is rerun and `worker-configuration.d.ts` committed.
- **Configured check.** `snapshotsConfigured(env)` is `Boolean(env.CF_ACCOUNT_ID && env.CF_BROWSER_TOKEN)`. When false the list item omits the button and the action answers the same SSE patch with the message `Snapshots are not configured`.
- **Browser Rendering call.** `POST https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/content`, headers `Authorization: Bearer ${CF_BROWSER_TOKEN}` and `Content-Type: application/json`, body `{"url": bookmark.url}`, `AbortSignal.timeout(60000)`. Success is HTTP 2xx with JSON `success: true` and a string `result`; anything else, including a thrown fetch, is a failure. No retry.
- **Rate rule.** Before inserting: if any `assets` row for the Tenant has `date_created` within the last ten seconds, answer with the message `Wait ten seconds between snapshots` and make no request. This is a Tenant-wide rule, not per Bookmark, because the platform limit is per account. `ponytail:` one row read per click; a `last_snapshot_at` column on `users.prefs` is the upgrade if the assets table grows large.
- **Lifecycle.** Insert the row as `pending` with `content_type` `text/html`, `display_name` `HTML snapshot from <YYYY-MM-DD HH:mm>` in UTC, `r2_key` `snapshots/<bookmark id>/<asset id>.html`; then `await` the render; on success `await ASSETS_BUCKET.put(key, html, { httpMetadata: { contentType: "text/html; charset=utf-8" } })`, update the row to `complete` with `file_size` as the UTF-8 byte length, and set `bookmarks.latest_snapshot_id`; on failure update the row to `failure`. Every SQL step after an `await` re-reads what it needs; nothing is held across the await. A row left `pending` by an aborted object is displayed as pending and can be deleted; `ponytail:` no reaper, add one when it happens.
- **Latest pointer.** `latest_snapshot_id` is the newest `complete` Asset. It is recomputed by `refreshLatestSnapshot(sql, bookmarkId)` after every completion and deletion: `SELECT id FROM assets WHERE bookmark_id = ? AND status = 'complete' ORDER BY date_created DESC, id DESC LIMIT 1`.
- **Deletion.** `deleteAsset(sql, bucket, id)` reads the key, deletes the row, refreshes the pointer, then `await bucket.delete(key)`. `deleteBookmark` in `src/db/bookmarks.ts` gains a step that reads the Bookmark's keys before the row delete and awaits `bucket.delete(keys)` after it; both API and UI deletion go through it. R2 failures after the row delete are logged with `console.warn` and not surfaced; `ponytail:` orphaned objects are cheap, a sweep can come later.
- **Serving.** `GET /assets/<id>` requires a session, answers 404 unless the row is `complete`, streams `bucket.get(key).body` with `Content-Type: text/html; charset=utf-8`, `Content-Security-Policy: sandbox`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=0`. The API download route sends the same body with `Content-Disposition: attachment; filename="<display_name>.html"`, filename with quotes and non-ASCII stripped.
- **UI action.** `POST /bookmarks/<id>/snapshot` is registered in `src/ui/bookmark_actions.tsx` next to the other per-item actions. With `Datastar-Request: true` it answers SSE through `ServerSentEventGenerator.stream` with one `patchElements` carrying the re-rendered `<li id="bookmark-<id>">`, whose message slot shows `Snapshot failed`, `Wait ten seconds between snapshots` or `Snapshots are not configured` when relevant. Without the header it answers 302 `/bookmarks`. A failed render is still HTTP 200 on the action, because the Datastar client ignores non-200 bodies. List items must carry `id="bookmark-<id>"`; if browse-bookmarks-ui did not add it, this slice adds it in `src/views/bookmark_list.tsx`.
- **List item.** Date link href is `/assets/<latest_snapshot_id>` when set, otherwise the Web Archive link. When the Bookmark has at least one Asset the item shows a link to `/bookmarks/<id>/edit#snapshots` with the text `<n> snapshot` or `<n> snapshots`.
- **Edit page.** `src/ui/bookmark_form.tsx` GET edit loads the Bookmark's Assets and renders `<section id="snapshots">` with one row per Asset: `display_name`, `status`, `file_size` in KB, a link to `/assets/<id>` for complete ones, and a form `POST /assets/<id>/delete` with a `confirm()` on submit. The delete route answers 302 to the edit page.
- **Assets API.** Under `/api/bookmarks/:id/assets/` in `src/api/assets.ts`, token-only like the rest of `src/api`. JSON fields exactly `id, bookmark, asset_type, date_created, content_type, display_name, status`. Upload answers 405 with `{"detail": "Method \"POST\" not allowed."}`. `disable_html_snapshot` on `POST /api/bookmarks/` is read and ignored.
- **Tests.** Browser Rendering is mocked with `network.use(http.post(RENDER, ...))`; the catch-all in `test/setup.ts` makes the unreachable case fail as required. Time moves with `vi.setSystemTime` for the ten-second rule. R2 is the plugin's local bucket; assertions go through `/assets/<id>` and the API, never through the bucket directly.

### Module shapes & seams

#### [NEW] Snapshots service (`src/services/snapshots.ts`)
```ts
export type SnapshotOutcome = { asset: Asset; message?: string };
export function snapshotsConfigured(env: Env): boolean;
export async function takeSnapshot(sql: SqlStorage, env: Env, bookmark: Bookmark, now: string): Promise<SnapshotOutcome | { message: string }>;
export async function deleteAsset(sql: SqlStorage, bucket: R2Bucket, id: number): Promise<boolean>;
export async function deleteAssetsOfBookmark(sql: SqlStorage, bucket: R2Bucket, bookmarkId: number): Promise<void>;
export function refreshLatestSnapshot(sql: SqlStorage, bookmarkId: number): void;
```
Dependencies: `fetch` (outbound, mocked in tests), `ASSETS_BUCKET`, the assets queries. Invariants: a row exists before the render starts; `latest_snapshot_id` always names a complete Asset or is null; no SQL cursor crosses an await. Test strategy: HTTP seam through the action and the API.

#### [NEW] Assets queries (`src/db/assets.ts`)
```ts
export type Asset = { id: number; bookmarkId: number; assetType: "snapshot"; contentType: string; displayName: string; r2Key: string; fileSize: number; status: "pending" | "complete" | "failure"; dateCreated: string };
export function insertAsset(sql, bookmarkId: number, displayName: string, now: string): Asset;   // pending, key derived from id
export function completeAsset(sql, id: number, fileSize: number): void;
export function failAsset(sql, id: number): void;
export function listAssets(sql, bookmarkId: number): Asset[];
export function findAsset(sql, id: number): Asset | null;
export function newestAssetTime(sql): string | null;
```

#### [MODIFIED] Bookmark queries (`src/db/bookmarks.ts`)
`deleteBookmark` becomes async and takes the bucket; `Bookmark` gains `latestSnapshotId: number | null`; list queries select it.

#### [MODIFIED] UI (`src/ui/bookmark_actions.tsx`, `src/ui/bookmark_form.tsx`, `src/views/bookmark_list.tsx`, `src/views/bookmark_form.tsx`)
Snapshot action, edit page section, delete route, date link and count link.

#### [NEW] Assets API (`src/api/assets.ts`)
Routes as listed; `toAssetJson(asset)`.

## Sequence
1. Migration 4, bindings, secrets in test config, `wrangler types`.
2. Assets queries and the service with the mocked render: take, fail, unreachable, rate rule, latest pointer.
3. List item: button, date link, count link, SSE patch; the plain-form redirect.
4. Serving `/assets/<id>` with headers and session check.
5. Edit page section and delete route, fallback to the previous Snapshot.
6. Bookmark deletion cleanup.
7. Assets API routes, 405 upload, 404s, 401, `disable_html_snapshot`.
8. Capability doc.
