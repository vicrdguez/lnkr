# Act on bookmarks from the list Plan

## Approach
The list page from browse-bookmarks-ui is split into fragments with stable ids, and a `renderListFragments` function renders list, sidebar and bulk bar for a given set of page signals. Each action route applies its change, then calls that function and streams the fragments as SSE through the helpers from edit-bookmarks-ui. Selection state lives only in client signals. Project conventions come from `.changes/stand-up-tenant/plan.md`; ids and query helpers from `.changes/browse-bookmarks-ui/plan.md`; the SSE helpers and signal conventions from `.changes/edit-bookmarks-ui/plan.md`.

New and changed files:
```
src/ui/bookmark_actions.tsx     POST /bookmarks/:id/archive|unarchive|delete|read, POST /bookmarks/bulk
src/views/bookmark_list.tsx     BulkBar, per-item buttons, checkboxes, page signals; renderListFragments()
src/db/bookmarks.ts             bulk functions with json_each, idsMatching(filter)
src/lib/signals.ts              PageSignals type and parsePageSignals()
test/act-on-bookmarks-ui.test.ts
```

## Implementation decisions

- **Page signals.** The list page's outer element carries `data-signals` with `{ q, sort, unread, page, selected: {}, selectAcross: false, bulkTags: "" }` rendered by the server from the request. `parsePageSignals(raw)` validates the shape and falls back to defaults, reusing the parameter rules of browse-bookmarks-ui. The archived flag is not a signal; it comes from a hidden signal `archived: true|false` rendered on the archive page so one bulk route serves both pages.
- **Item keys.** Checkboxes bind to `selected.b<id>` so keys are valid signal names. The server accepts `selected` as an object and takes the ids of keys with a true value, stripping the `b`.
- **Per-item routes.** `POST /bookmarks/:id/archive`, `/unarchive`, `/delete`, `/read`. Under `requireSession` and `requireDatastar`, then `readSignals`. Unknown id: 404 plain text. After the change, re-render with the signals; if the requested `page` exceeds the last page, use the last page and also patch `page`. Response: one `patchElements` call with the list `ul` and the sidebar `aside` concatenated, which Datastar morphs by id, plus a `patchSignals` when the page changed.
- **Buttons.** `<button type="button" data-on:click="@post('/bookmarks/<id>/archive')">Archive</button>`; Delete uses `data-on:click="confirm('Delete this bookmark?') && @post('/bookmarks/<id>/delete')"`. The archive page renders Unarchive instead of Archive. Mark read renders only for unread items. The action carries the page signals automatically because Datastar sends all signals as the JSON body of a POST.
- **Bulk route.** `POST /bookmarks/bulk`. Signals: `action` in `archive|unarchive|delete|tag|untag|read|unread` else 400; `selected`, `selectAcross`, `bulkTags`, page signals, `archived`. Target ids: when `selectAcross` is true, `idsMatching(filter)` with the page's archived flag, unread filter and compiled search; otherwise the selected ids. Empty target: no change, still re-render. Tag names for `tag` and `untag` come from `bulkTags` split on whitespace through the shared normalisation; `untag` matches names ignoring case. Response: `patchElements` with list, sidebar and bulk bar, then `patchSignals` `{ selected: {}, selectAcross: false, bulkTags: "" }` plus `page` when it changed.
- **Bulk queries** take the id list as one JSON array bound to a single parameter and use `IN (SELECT value FROM json_each(?))`, so any number of ids fits the hundred-parameter limit. `bulkSetArchived`, `bulkDelete`, `bulkSetUnread`, `bulkAddTags`, `bulkRemoveTags`, each setting `date_modified` on touched rows; `bulkDelete` removes `bookmark_tags` first.
- **Bulk bar markup.** `<div id="bulk-bar">` with: `<span data-text="Object.values($selected).filter(Boolean).length"></span> selected`; a Select all checkbox whose `data-on:change` assigns `$selected` to an object literal of this page's keys set to `evt.target.checked`, rendered by the server; a label with a checkbox `data-bind:selectAcross` wrapped in `data-show` that is true when every key on the page is selected, the expression also rendered by the server; buttons `data-on:click="$action = 'archive'; @post('/bookmarks/bulk')"` and so on, Delete wrapped in `confirm('Delete the selected bookmarks?') &&`; an input `data-bind:bulkTags` with placeholder `tags`. `action` is a signal declared in the page signals as `""`.
- **Request requirements.** `requireDatastar` answers 400 without the header; a body that is not JSON answers 400. These routes are outside the CSRF middleware; cross-site protection is the header plus `SameSite=Lax` plus JSON content type.
- **Escaping.** Server-rendered expressions embed only integers and the literal keys `b<id>`; no user text ever lands inside a `data-on` expression. Tag names in the bulk bar never appear in expressions.

### Module shapes & seams

#### [NEW] Action routes (`src/ui/bookmark_actions.tsx`)
```ts
export const bookmarkActions: Hono<AppEnv>;
```
Test strategy: HTTP seam with JSON bodies and the Datastar header, asserting on SSE text and on the API afterwards.

#### [MODIFIED] List rendering (`src/views/bookmark_list.tsx`)
```ts
export function renderListFragments(sql, signals: PageSignals, archived: boolean): { list: string; sidebar: string; bulkBar: string; page: number };
```
Used by the GET pages and every action, so the HTML is identical either way.

#### [MODIFIED] Bookmark queries (`src/db/bookmarks.ts`)
```ts
export function idsMatching(sql, filter: ListFilter): number[];
export function bulkSetArchived(sql, ids: number[], archived: boolean, now: string): void;
export function bulkDelete(sql, ids: number[]): void;
export function bulkSetUnread(sql, ids: number[], unread: boolean, now: string): void;
export function bulkAddTags(sql, ids: number[], names: string[], now: string): void;
export function bulkRemoveTags(sql, ids: number[], names: string[], now: string): void;
```
Invariant: each takes the ids through `json_each`; none touches rows outside `ids`.

## Sequence
1. Page signals, ids, buttons and checkboxes on the list; `renderListFragments`.
2. Per-item routes and their scenarios, including the page step-back.
3. Bulk queries and the bulk route with selected ids.
4. Tag and untag, select across, reset signals.
5. Request requirement scenarios.
6. Capability doc.
