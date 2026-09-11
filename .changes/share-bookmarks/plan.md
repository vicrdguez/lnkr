# Share bookmarks Plan

## Approach
Tenants push, the Directory serves. Every write path that can change what a Tenant shares ends with one call, `syncShared(sql, env, bookmarkIds)`, which reads the affected rows and upserts or removes index entries in the Directory through RPC. The shared page and feeds read the index only, so a page never touches another Tenant's object. The anonymous page and public feed live on the Directory app, which already serves credential-less requests. Project conventions come from `.changes/stand-up-tenant/plan.md`; preferences from `.changes/tune-display-preferences/plan.md`; actions from `.changes/act-on-bookmarks-ui/plan.md`; feeds from `.changes/serve-feeds-and-tokens/plan.md`; the Directory from `.changes/add-directory/plan.md` and `.changes/administer-users/plan.md`.

New and changed files:
```
src/db/directory.ts            Directory migration 2: shared_bookmarks; index queries
src/directory.ts               RPC upsertShared, removeShared, replaceShared, listShared, sharedOwners; anonymous /bookmarks/shared, /feeds/shared, landing redirect
src/services/shared.ts         syncShared(), replaceAllShared(), sharedEntry()
src/ui/shared.tsx              logged-in /bookmarks/shared
src/views/shared_list.tsx      SharedList, shared by both apps
src/ui/settings.tsx            Sharing section, POST /settings/sharing, /settings/sharing/resync
src/ui/bookmark_actions.tsx    share, unshare, bulk share and unshare
src/ui/bookmarks.tsx           shared=yes|no filter
src/ui/feeds.ts                /feeds/:token/shared
src/api/profile.ts             real flags
src/views/bookmark_form.tsx    shared checkbox
test/share-bookmarks.test.ts
```

## Implementation decisions

- **Preferences.** `enable_sharing`, `enable_public_sharing`, `default_mark_shared`, booleans default false, in the prefs document. `POST /settings/sharing` saves them, then calls `replaceAllShared(sql, env)`: with sharing off it sends an empty list, with sharing on it sends every Bookmark whose `shared` is 1, with `public` equal to `enable_public_sharing`. `POST /settings/sharing/resync` calls the same function.
- **Directory migration 2:**
  ```sql
  CREATE TABLE shared_bookmarks (
    tenant_key TEXT NOT NULL,
    bookmark_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    tag_names TEXT NOT NULL,
    date_added TEXT NOT NULL,
    date_modified TEXT NOT NULL,
    public INTEGER NOT NULL,
    PRIMARY KEY (tenant_key, bookmark_id)
  );
  CREATE INDEX shared_bookmarks_date ON shared_bookmarks(date_added DESC);
  ```
  `tag_names` is a JSON array. The username is copied in so listing needs no join; `administer-users` rename does not exist, so it never goes stale.
- **Directory RPC.**
  ```ts
  upsertShared(entries: SharedEntry[]): void;              // INSERT OR REPLACE
  removeShared(tenantKey: string, bookmarkIds: number[]): void;
  replaceShared(tenantKey: string, entries: SharedEntry[]): void;   // delete all for the key, then insert
  listShared(opts: { q: string; user: string | null; publicOnly: boolean; limit: number; offset: number }): { count: number; rows: SharedEntry[] };
  sharedOwners(publicOnly: boolean): string[];
  ```
  `listShared` filters with `instr(lower(title|description|url), ?)` for each whitespace-separated word of `q`, all required, `username = ? COLLATE NOCASE` for `user`, `public = 1` when `publicOnly`, ordered `date_added DESC, tenant_key, bookmark_id DESC`.
- **`syncShared(sql, env, bookmarkIds)`.** Reads the rows and their tags; for each: when sharing is on and `shared` is 1, an entry goes into the upsert list; otherwise the id goes into the remove list; missing rows go into the remove list. One `upsertShared` and one `removeShared` RPC. Called after: API create, put, patch, delete; form save; per-item share, unshare, delete, archive and unarchive (archived Bookmarks stay shared, so these only refresh content); bulk actions with the affected ids; import. The call is awaited after storage writes complete and before the response; a thrown RPC error is caught, logged with `console.warn`, and the response proceeds. `ponytail:` no retry queue; Re-sync on settings repairs drift.
- **Share actions.** `POST /bookmarks/:id/share` and `/unshare` in `src/ui/bookmark_actions.tsx`, same shape as archive; bulk `share` and `unshare` set the flag on the targets. Buttons and bulk buttons render only when `enable_sharing`. The own list pages accept `shared=yes|no` as a filter added to `ListFilter` as `shared?: boolean`, with a select in the search form shown when sharing is on, and carried as a page signal `shared`.
- **Form.** The new and edit forms get a `shared` checkbox when sharing is on, preselected on new by `default_mark_shared`, and pass it through `saveBookmark`.
- **Shared page.** `SharedList` renders the list layout with owner username per item, tag links to `/bookmarks/shared?q=<tag>`, a sidebar of owners linking to `?user=`, pagination at thirty keeping `q` and `user`, no actions, no bulk bar, no Datastar signals. Logged in: `src/ui/shared.tsx` on the Tenant calls `directory.listShared({ publicOnly: false })` and renders with the user's prefs and the normal nav. Anonymous: the Directory app route `GET /bookmarks/shared` calls its own query with `publicOnly: true` and renders with a minimal nav holding `Log in`, styled by the guest profile: when `guest_profile_user_id` is set, the Directory calls that Tenant's RPC `getGuestPrefs()` returning `{ theme, bookmark_link_target, bookmark_date_display }` cached per request; otherwise defaults.
- **Feeds.** `/feeds/shared` on the Directory app, public rows, `q` and `limit` as the other feeds, channel title `Shared bookmarks`. `/feeds/:token/shared` on the Tenant feeds router, all rows, same query. Both render through `renderRss` with `SharedEntry` mapped to the item shape.
- **Landing page.** The Directory's `/` reads `settings.landing_page`; `shared_bookmarks` answers 302 `/bookmarks/shared`, otherwise `/login`.
- **Deletion of a user.** `deleteUser` in the Directory also deletes the user's `shared_bookmarks` rows.
- **Profile.** `enable_sharing` and `enable_public_sharing` from prefs.
- **Tests** at the HTTP seam with two users set up through the admin page; the re-sync scenario removes an index row inside the Directory through `runInDurableObject`, which is the one storage-seam step.

### Module shapes & seams

#### [NEW] Shared sync (`src/services/shared.ts`)
```ts
export type SharedEntry = { tenantKey: string; bookmarkId: number; username: string; url: string; title: string; description: string; tagNames: string[]; dateAdded: string; dateModified: string; public: boolean };
export function sharedEntry(row: BookmarkRow, tags: string[], ctx: { tenantKey: string; username: string; public: boolean }): SharedEntry;
export async function syncShared(sql: SqlStorage, env: Env, ids: number[]): Promise<void>;
export async function replaceAllShared(sql: SqlStorage, env: Env): Promise<void>;
```
Invariant: after `syncShared(ids)` the index holds exactly the shared, sharing-enabled rows among `ids`. Test strategy: HTTP seam through the shared page.

#### [MODIFIED] Directory (`src/directory.ts`, `src/db/directory.ts`)
RPC and routes as listed. Test strategy: HTTP seam.

#### [NEW] Shared page and view (`src/ui/shared.tsx`, `src/views/shared_list.tsx`)
Test strategy: HTTP seam.

## Sequence
1. Directory migration 2, RPC, `syncShared` on the API write paths; the API-based scenarios.
2. Sharing settings section, replace on toggle, re-sync, profile.
3. Share actions, bulk, form checkbox, list filter.
4. Logged-in shared page with q, user, pagination.
5. Anonymous page, public flag, guest profile, landing page.
6. Feeds.
7. Capability doc.
