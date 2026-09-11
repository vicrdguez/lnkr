# Serve feeds and named tokens Plan

## Approach
Two credentials, one page section, two GET routes that render XML from the same bookmark query the list uses. Follow `.changes/stand-up-tenant/plan.md` for conventions, `.changes/serve-extension-api/` for the token table and `.changes/search-bookmarks/` for the query compiler. Merged module names are authoritative.

## Implementation decisions

- **Migration.** Append version 3 to `migrations` in `src/db/schema.ts`: `CREATE TABLE feed_tokens (key TEXT PRIMARY KEY, created TEXT NOT NULL)`. The implementer must renumber if another migration has merged since serve-extension-api; the version is the array index plus one, nothing else.
- **API tokens.** Table `api_tokens(key, name, created)` from serve-extension-api is reused unchanged. Key: 20 random bytes as 40 lowercase hex characters. Create: POST `/settings/tokens` with `name`, trimmed, required; inserts the row and answers 200 with the settings page carrying a "Copy your new token" box containing the key. Every GET of `/settings` lists tokens as name and `created` date with a Revoke form posting to `/settings/tokens/<id>/revoke`, where `<id>` is the key's rowid; revoke deletes the row and answers 302 `/settings`. The Regenerate route and the token display from serve-extension-api are deleted. Rows with an empty name are listed as `Default`.
- **Feed token.** One row in `feed_tokens`; created with the same key generator on first GET of `/settings` when the table is empty. Shown as two absolute URLs built from the request origin.
- **Feeds.** Router `src/ui/feeds.ts` mounted outside the session middleware. `GET /feeds/:token/:kind` with `kind` in `all` or `unread`; anything else 404; token looked up in `feed_tokens`, missing 404. Query: the same bookmark list query the API uses, with `archived = false`, plus `unread = true` for `unread`, `q` compiled by `compileSearch`, ordered `date_added DESC, id DESC`, `LIMIT` from `limit` parsed as a positive integer with default 100.
- **RSS.** Hand-built string, no XML library. Header `<?xml version="1.0" encoding="UTF-8"?>`, `<rss version="2.0"><channel>` with `<title>All bookmarks</title>` or `Unread bookmarks`, `<link>` the Instance's `/bookmarks` URL, `<description>` equal to the title. Item: `<title>` title or URL when empty, `<link>` URL, `<description>` description, `<pubDate>` `date_added` formatted with `toUTCString()`, `<guid>` the URL. Escape `&`, `<`, `>`, `"` in every value with one `xmlEscape` helper. `Content-Type: application/rss+xml; charset=utf-8`.
- **CSRF.** Feeds are GET; nothing to exempt. Token forms are session-only and go through `hono/csrf`.
- **Profile and extension.** Unchanged.

### Module shapes & seams

#### [MODIFIED] Tokens (`src/db/tokens.ts`)
```ts
export function listApiTokens(sql): { id: number; name: string; created: string }[];
export function createApiToken(sql, name: string, now: string): { id: number; key: string };
export function deleteApiToken(sql, id: number): void;
export function getOrCreateFeedToken(sql, now: string): string;
export function feedTokenExists(sql, key: string): boolean;
```
Invariant: a listing never returns a key. Test strategy: HTTP seam through the settings page and the API.

#### [NEW] Feeds (`src/ui/feeds.ts`)
```ts
export const feeds: Hono<AppEnv>;   // GET /feeds/:token/:kind
export function renderRss(kind: "all" | "unread", origin: string, items: BookmarkRow[]): string;
```
Dependencies: `compileSearch`, the bookmark query functions. Test strategy: HTTP seam; the body is checked as text.

#### [MODIFIED] Settings (`src/ui/settings.tsx`)
Integrations section replaces the single-token section.

## Sequence
1. Migration 3, `getOrCreateFeedToken`, feed token scenarios.
2. Named token queries, settings section, token scenarios; delete the Regenerate route.
3. Feeds router and `renderRss`, feed scenarios.
4. Capability doc.
