# Serve the browser extension API Plan

## Approach
Add the bookmark and tag schema, a token-authenticated `/api` router mounted next to the UI, and one settings section for the token. Every endpoint maps to one query function in `src/db/` and one serializer, so linkding's field names live in exactly one place. Page metadata is a small service around `fetch` and `HTMLRewriter`. Project conventions come from `.changes/stand-up-tenant/plan.md` on `main`; this plan only adds to them.

New files:
```
src/db/bookmarks.ts      bookmark queries, tag attachment, list with pagination
src/db/tags.ts           tag queries
src/db/tokens.ts         api_tokens queries
src/auth/token.ts        requireToken middleware
src/api/index.ts         mounts the API routers, strict: false
src/api/bookmarks.ts     bookmarks, archived, check, archive, unarchive
src/api/tags.ts
src/api/profile.ts
src/api/serialize.ts     bookmarkJson(), tagJson(), errors
src/api/envelope.ts      paginate(): count, next, previous, results
src/services/metadata.ts fetchPageMetadata()
src/views/settings.tsx   token section (extends the existing settings page)
test/serve-extension-api.test.ts
```

## Implementation decisions

- **Migration version 2** appended to `migrations` in `src/db/schema.ts`:
  ```sql
  CREATE TABLE bookmarks (
    id INTEGER PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    unread INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    shared INTEGER NOT NULL DEFAULT 0,
    date_added TEXT NOT NULL,
    date_modified TEXT NOT NULL
  );
  CREATE INDEX bookmarks_list ON bookmarks(is_archived, date_added DESC);
  CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    date_added TEXT NOT NULL
  );
  CREATE TABLE bookmark_tags (
    bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id),
    tag_id INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (bookmark_id, tag_id)
  );
  CREATE INDEX bookmark_tags_tag ON bookmark_tags(tag_id);
  CREATE TABLE api_tokens (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL
  );
  ```
  Booleans are integers 0 and 1. Foreign keys are documentation only: the code deletes `bookmark_tags` rows explicitly when a bookmark or tag is deleted and never relies on `PRAGMA foreign_keys`.
- **Router.** `src/api/index.ts` creates `new Hono<AppEnv>({ strict: false })` so `/api/bookmarks` and `/api/bookmarks/` are the same route, applies `requireToken` to everything under it, and is mounted at `/api` by `createApp`. The CSRF middleware is applied to the UI router only; `/api` never sees it and never reads cookies. Fixed paths such as `check/` and `archived/` are registered before the `:id` routes.
- **Token auth.** `Authorization: Token <key>` only. Missing header or wrong scheme answers 401 `{"detail": "Authentication credentials were not provided."}`; unknown key answers 401 `{"detail": "Invalid token."}`. A valid key sets `c.set("user", user)` from the single `users` row. The key is 20 random bytes as 40 lowercase hex characters.
- **Settings token section.** `/settings` renders the token in `<code id="api-token">`, creating a row on first render when none exists. `POST /settings/token/regenerate` deletes every row and creates one, then 302 `/settings`. Tests read the token from that element.
- **Bookmark JSON** in `src/api/serialize.ts`, key order exactly: `id, url, title, description, notes, web_archive_snapshot_url, favicon_url, preview_image_url, is_archived, unread, shared, tag_names, date_added, date_modified`. `web_archive_snapshot_url` is always `""`, `favicon_url` and `preview_image_url` always `null`, `tag_names` ordered by name case-insensitively. Tag JSON: `id, name, date_added`.
- **Errors** follow Django REST framework: `{"detail": "Not found."}` with 404; validation as `{"<field>": ["<message>"]}` with 400. Messages used: `Enter a valid URL.`, `This field is required.`, `A bookmark with this URL already exists.`. Malformed JSON bodies answer 400 `{"detail": "JSON parse error"}`.
- **Input.** Request bodies are JSON only. Unknown fields are ignored. Booleans must be JSON booleans; strings for string fields; `tag_names` an array of strings; anything else answers 400 for that field with `Invalid value.`.
- **URL validation.** `new URL(value)` must succeed and `protocol` must be `http:` or `https:`; the value is trimmed first and stored as trimmed. Duplicates are exact matches on the stored string.
- **Tag names.** Trim each, drop empties, deduplicate case-insensitively keeping the first spelling, look up by name with `COLLATE NOCASE`, create when missing with `date_added` now. Attachments are replaced wholesale on every write that includes `tag_names`.
- **Create.** Validate first. Decide whether scraping is needed: the `disable_scraping` query parameter is absent and title or description is empty. If so `await fetchPageMetadata(url)` before touching storage, then in one synchronous block: find by url; update the existing row's provided fields and set `date_modified`, or insert with `date_added` and `date_modified` now; write tags; answer 201 with the JSON. Scraped values fill only empty fields. The `disable_html_snapshot` parameter the extension sends is accepted and ignored.
- **Update.** `PUT` requires `url`, then sets every writable field from the body with defaults for omitted ones: empty strings, `false`, `[]`. `PATCH` sets only present fields. Both set `date_modified`. A url that belongs to another bookmark answers 400 on `url`.
- **List.** `listBookmarks(sql, { archived, limit, offset, modifiedSince, addedSince })` orders by `date_added DESC, id DESC`. `limit` default 100, `offset` default 0, both non-negative integers, otherwise defaults. Date filters compare ISO strings with `>=`; an unparsable value is treated as absent. Envelope built by `paginate(c, count, results)`: `next` is the request URL with `offset` set to `offset + limit` when `offset + limit < count`, `previous` is the request URL with `offset` set to `offset - limit`, or with `offset` removed when that is zero or less, and null when `offset` is zero. URLs are absolute, taken from `c.req.url`.
- **Delete and actions.** `DELETE` removes `bookmark_tags` rows then the bookmark, 204. `archive` and `unarchive` set `is_archived` and `date_modified`, 204. Unknown ids answer 404 on every `:id` route.
- **Check.** `url` query parameter required, else 400 `{"url": ["This field is required."]}`. Answer `{ bookmark, metadata: { title, description }, auto_tags: [] }` where `bookmark` is the JSON of the exact-url match or null, and metadata comes from `fetchPageMetadata`. Metadata is fetched even when the bookmark exists, as linkding does.
- **Page metadata.** `fetchPageMetadata(url, fetchImpl = fetch)` issues `GET` with `Accept: text/html`, `User-Agent: lnkr/<version>` and `AbortSignal.timeout(5000)`. A non-2xx status, a content type without `text/html`, a thrown error or a timeout return `{ title: null, description: null }`. Parsing uses `HTMLRewriter` handlers on `title`, `meta[name="description"]`, `meta[property="og:title"]`, `meta[property="og:description"]`; the transformed body is read until one megabyte and then cancelled. Title is `<title>` text with whitespace collapsed, falling back to `og:title`; description is `meta[name=description]` falling back to `og:description`; empty strings become null. The service returns values; it never writes.
- **Profile.** `GET /api/user/profile/` returns the fixed document in behavior.md with `version` from `package.json`.
- **Concurrency.** The only `await` before a write is the metadata fetch, and it happens before any read of the bookmarks table, so the find-or-update block runs without interleaving. Cursors are consumed before any `await`.

### Module shapes & seams

#### [NEW] Bookmarks queries (`src/db/bookmarks.ts`)
```ts
export type BookmarkRow = { id: number; url: string; title: string; description: string; notes: string; unread: number; is_archived: number; shared: number; date_added: string; date_modified: string };
export type BookmarkInput = { url: string; title?: string; description?: string; notes?: string; unread?: boolean; is_archived?: boolean; shared?: boolean; tag_names?: string[] };
export function findBookmarkByUrl(sql, url: string): BookmarkRow | null;
export function getBookmark(sql, id: number): BookmarkRow | null;
export function insertBookmark(sql, input: Required<BookmarkInput>, now: string): BookmarkRow;
export function updateBookmark(sql, id: number, patch: Partial<BookmarkInput>, now: string): BookmarkRow;
export function deleteBookmark(sql, id: number): boolean;
export function setArchived(sql, id: number, archived: boolean, now: string): boolean;
export function setTags(sql, id: number, names: string[], now: string): void;
export function tagNamesOf(sql, id: number): string[];
export function listBookmarks(sql, opts: { archived: boolean; limit: number; offset: number; modifiedSince?: string; addedSince?: string }): { count: number; rows: BookmarkRow[] };
```
Invariant: `url` is unique; every write sets `date_modified`. Test strategy: HTTP seam only.

#### [NEW] Page metadata (`src/services/metadata.ts`)
```ts
export type PageMetadata = { title: string | null; description: string | null };
export function fetchPageMetadata(url: string, fetchImpl: typeof fetch = fetch): Promise<PageMetadata>;
```
Dependency: outbound `fetch`, mocked in tests with msw. Invariant: never throws, never takes longer than the timeout. Test strategy: HTTP seam through `check` and create.

#### [NEW] Token middleware (`src/auth/token.ts`)
```ts
export const requireToken: MiddlewareHandler<AppEnv>;
```
Test strategy: HTTP seam.

#### [MODIFIED] Settings page (`src/ui/settings.tsx`, `src/views/settings.tsx`)
Adds the token section and the regenerate route. Test strategy: HTTP seam.

#### [MODIFIED] Test helpers (`test/helpers.ts`)
Add `apiToken(cookie)` reading `<code id="api-token">` from `/settings`, `api(token)` returning a small client with `get`, `post`, `put`, `patch`, `del` that sets the header and JSON body, and `mockPage(url, html)` registering an msw handler that answers `text/html`.

## Sequence
1. Migration 2, query modules, serializer, `requireToken`, profile endpoint; auth and profile scenarios.
2. Token section on settings and its scenarios.
3. Create with tags, then the update-on-existing scenario.
4. `fetchPageMetadata` and the scraping scenarios on create.
5. List, archived list, pagination and date filters.
6. Get, put, patch, delete, archive, unarchive, 404s.
7. Check.
8. Tags endpoints.
9. Capability doc.
