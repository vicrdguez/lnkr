# Browse bookmarks in the UI Plan

## Approach
One UI router serves both list pages from the same handler with an `archived` flag. It parses the query parameters, compiles `q` with `compileSearch`, asks `listBookmarks` for the page and count, asks a new `tagCounts` query for the sidebar, and renders JSX views. There is no client-side code; notes use `details`, everything else is links and one GET form. Project conventions come from `.changes/stand-up-tenant/plan.md`.

New and changed files:
```
src/ui/bookmarks.tsx       GET /bookmarks, GET /bookmarks/archived, root redirect change
src/views/bookmark_list.tsx BookmarkPage, BookmarkItem, Sidebar, Pagination, SearchForm
src/views/layout.tsx        nav with Bookmarks, Archived, Settings, Logout and the active class
src/lib/dates.ts            relativeDate(iso, now), archiveTimestamp(iso)
src/lib/query.ts            pageUrl(base, params, changes) for links that keep the query
src/db/bookmarks.ts         sort option on listBookmarks; tagCounts()
public/static/style.css     list, sidebar, pagination, forms
test/browse-bookmarks-ui.test.ts
```

## Implementation decisions

- **Parameters.** `q` string, default empty. `sort` one of `added_desc`, `added_asc`, `title_asc`, `title_desc`, anything else is `added_desc`. `unread` is a filter only when exactly `yes`. `page` a positive integer, default 1; when it exceeds the last page the last page is served and its number is shown. Page size is the constant `ITEMS_PER_PAGE = 30` in `src/ui/bookmarks.tsx`; it becomes a preference in tune-display-preferences.
- **Sort mapping** in `listBookmarks`: `added_desc` → `date_added DESC, id DESC`; `added_asc` → `date_added ASC, id ASC`; `title_asc` → `title COLLATE NOCASE ASC, id ASC`; `title_desc` → `title COLLATE NOCASE DESC, id DESC`. The API keeps using `added_desc` and passes nothing new.
- **Unread filter** adds `b.unread = 1` to the `WHERE` in `listBookmarks` through a new `unread?: boolean` option.
- **Tag counts.** `tagCounts(sql, { archived, unread, search })` runs `SELECT t.name AS name, count(*) AS count FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.bookmark_id IN (SELECT b.id FROM bookmarks b WHERE <same where as the list>) GROUP BY t.id ORDER BY t.name COLLATE NOCASE`. The `WHERE` text and params are built by one shared function inside `src/db/bookmarks.ts` so the list, the count and the sidebar can never disagree.
- **Selected tags** are the `#name` tokens found in `q` by a simple scan for tokens starting with `#` outside quotes; the sidebar compares names case-insensitively. Adding a tag appends a space and `#name` to the trimmed `q`; removing one deletes that token and collapses the whitespace. Links are built with `pageUrl`, which keeps every other parameter, drops `page`, and encodes with `URLSearchParams` so spaces become `+` and `#` becomes `%23`.
- **Pagination links** keep `q`, `sort` and `unread` and set `page`; `page=1` is written explicitly on the Previous link. `Previous` is omitted on page 1 and `Next` on the last page. The label is `Page <n> of <max(total pages, 1)>`.
- **List item.** Title link with `target="_blank"` and `rel="noopener"`, text is the title or, when empty, the URL. Description in a `p` when non-empty. Tags as links to `pageUrl` with `q` set to `#name` only. Notes, when non-empty, inside `<details class="notes"><summary>Notes</summary><pre>…</pre></details>`; the `pre` holds the raw text, which JSX escapes, and the stylesheet sets `white-space: pre-wrap`. Date: `<a class="date" href="<web archive link>" title="<YYYY-MM-DD HH:MM UTC>" target="_blank">` with relative text. The `li` carries `unread` when `unread` is 1 and `id="bookmark-<id>"` for later slices.
- **Web Archive link** is `https://web.archive.org/web/` + `archiveTimestamp(date_added)` + `/` + url, where `archiveTimestamp` formats the UTC instant as `YYYYMMDDhhmmss`. Nothing is stored.
- **Relative date** from `relativeDate(iso, now)`: under a minute `just now`; under an hour `N minutes ago`; under a day `N hours ago`; under a week `N days ago`; under thirty days `N weeks ago`; under a year `N months ago`; otherwise `N years ago`, each with singular forms for 1. The tooltip is `YYYY-MM-DD HH:MM` in UTC. Both take `now` as a parameter and the handler passes `Date.now()`.
- **Root.** `/` now answers 302 `/bookmarks` with a session; the login redirect for anonymous visitors is unchanged.
- **Empty states.** `No bookmarks yet` when the unfiltered count for the page's archived flag is zero; `No bookmarks found` when a filter is active and the result is empty.
- **Element ids.** The list is `<ul id="bookmark-list">`, the sidebar `<aside id="sidebar">`, each item `<li id="bookmark-<id>">`; act-on-bookmarks-ui patches the first two by id and must not have to rename them.
- **Nav.** `Layout` takes `section: "bookmarks" | "archived" | "settings" | undefined` and adds `class="active"` to the matching link.
- **Escaping.** Everything renders through JSX; no `dangerouslySetInnerHTML`. Tag names and titles are user data.
- **Stylesheet.** Plain CSS, one column on narrow screens and list plus sidebar on wide ones, no framework.

### Module shapes & seams

#### [NEW] List page (`src/ui/bookmarks.tsx`)
```ts
export const bookmarkPages: Hono<AppEnv>;   // GET /bookmarks, GET /bookmarks/archived
export const ITEMS_PER_PAGE = 30;
```
Test strategy: HTTP seam, asserting on the HTML with a small DOM-free helper that extracts elements by regular expression or with the `HTMLRewriter` available in workerd; either is acceptable, pick one in `test/helpers.ts` and reuse it in later UI slices.

#### [MODIFIED] Bookmark queries (`src/db/bookmarks.ts`)
```ts
export type ListSort = "added_desc" | "added_asc" | "title_asc" | "title_desc";
export type ListFilter = { archived: boolean; unread?: boolean; search?: SearchFilter; modifiedSince?: string; addedSince?: string };
export function listBookmarks(sql, opts: ListFilter & { limit: number; offset: number; sort?: ListSort }): { count: number; rows: BookmarkRow[] };
export function tagCounts(sql, filter: ListFilter): { name: string; count: number }[];
export function tagNamesFor(sql, ids: number[]): Map<number, string[]>;   // one query for a page, using json_each
```
Invariant: list, count and sidebar share one `WHERE` builder.

#### [NEW] Dates and links (`src/lib/dates.ts`, `src/lib/query.ts`)
```ts
export function relativeDate(iso: string, nowMs: number): string;
export function absoluteDate(iso: string): string;      // "YYYY-MM-DD HH:MM"
export function archiveTimestamp(iso: string): string;  // "YYYYMMDDhhmmss"
export function pageUrl(path: string, current: URLSearchParams, changes: Record<string, string | null>): string;
```
Test strategy: HTTP seam through the rendered page.

## Sequence
1. Nav, root redirect and the plain list with items and empty states.
2. Search, sort and unread with the form.
3. Pagination.
4. Sidebar.
5. Escaping and date link scenarios, stylesheet.
6. Capability doc.
