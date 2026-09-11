# Save bundles Plan

## Approach
A Bundle is stored as text fields and turned into a `SearchFilter` by one function, `bundleFilter`, that reuses `compileSearch` for its search part and adds tag `EXISTS` clauses for the lists. `ListFilter` gains an optional second filter, so the list, count, tag sidebar and select-across all apply it through the shared `WHERE` builder. Pages and API are thin. Project conventions come from `.changes/stand-up-tenant/plan.md`; the list machinery from `.changes/browse-bookmarks-ui/plan.md` and `.changes/act-on-bookmarks-ui/plan.md`; the API conventions from `.changes/serve-extension-api/plan.md`.

New and changed files:
```
src/db/bundles.ts            queries, bundleFilter()
src/ui/bundles.tsx           /bundles pages, up, down, delete
src/views/bundles.tsx        BundleList, BundleForm, sidebar section
src/api/bundles.ts           /api/bundles routes and bundleJson()
src/db/bookmarks.ts          ListFilter.bundle; API and pages pass it
src/lib/signals.ts           bundle page signal
test/save-bundles.test.ts
```

## Implementation decisions

- **Migration 5** (after snapshot-bookmarks' 4; renumber if that one has not merged yet):
  ```sql
  CREATE TABLE bundles (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    search TEXT NOT NULL DEFAULT '',
    any_tags TEXT NOT NULL DEFAULT '',
    all_tags TEXT NOT NULL DEFAULT '',
    excluded_tags TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    date_created TEXT NOT NULL,
    date_modified TEXT NOT NULL
  );
  ```
- **Ordering.** `sort_order` is a dense sequence from 0 kept by the code: a new Bundle gets `max + 1` unless the API gives `order`, in which case it is inserted at that position and the rest shift; `up` and `down` swap with the neighbour; delete renumbers. Lists are ordered by `sort_order, id`.
- **`bundleFilter(bundle): SearchFilter | null`.** `null` when `search` fails to parse, which makes the list empty like a bad `q`. Parts: `compileSearch(search)` when non-empty; for each name in `any_tags`, one `EXISTS (... t.name = ? COLLATE NOCASE)` joined with `OR` inside parentheses; for each name in `all_tags` one `EXISTS` joined with `AND`; for each name in `excluded_tags` one `NOT EXISTS`. Names are split on whitespace, trimmed, deduplicated regardless of case. Empty parts contribute nothing; a Bundle with every part empty yields `1 = 1`. The whole is ANDed with the request's `q` filter by the list layer.
- **`ListFilter`** gains `bundle?: SearchFilter`; the shared `WHERE` builder appends it after `search`. `listBookmarks`, `tagCounts` and `idsMatching` therefore all honour it without further change.
- **Pages.** `bundle` query parameter parsed as a positive integer; a missing Bundle is ignored. The list page passes `bundle` as a page signal, `pageUrl` keeps it, and `parsePageSignals` reads it; `renderListFragments` resolves the Bundle by id on every render so an action after a deletion degrades to the unfiltered view. The sidebar's Bundles section is rendered before the tags section only when at least one Bundle exists; the active link carries `class="active"`; Clear links to the same page without `bundle`.
- **Bundle pages.** `GET /bundles` lists name, search summary, Up and Down forms (`POST /bundles/:id/up`, `/down`) and a Delete form with `confirm()`; `GET /bundles/new` and `GET /bundles/:id/edit` share `BundleForm` with inputs `name`, `search`, `any_tags`, `all_tags`, `excluded_tags` and a note about whitespace-separated tags; POSTs validate `name` non-empty after trimming, answer 400 with the form on error, 302 `/bundles` on success. Nav gains a `Bundles` link.
- **API.** Router `src/api/bundles.ts` under `/api/bundles` with the same token middleware, `strict: false`, envelope from `paginate` with `limit` and `offset`. JSON keys in order `id, name, search, any_tags, all_tags, excluded_tags, order, date_created, date_modified`, `order` mapping to `sort_order`. `POST` requires `name`, other fields default to empty strings, `order` optional; `PUT` requires `name` and resets omitted text fields to empty and leaves `order` unchanged when omitted; `PATCH` changes given fields; `DELETE` answers 204; unknown ids 404. The bookmarks list endpoints read `bundle`, answer 400 `{"bundle": ["Invalid bundle."]}` when it is not an existing id, and pass `bundleFilter`.
- **Tests** at the HTTP seam; the composition outline creates a Bundle through the API per row and reads the bookmarks API.

### Module shapes & seams

#### [NEW] Bundle queries (`src/db/bundles.ts`)
```ts
export type BundleRow = { id: number; name: string; search: string; any_tags: string; all_tags: string; excluded_tags: string; sort_order: number; date_created: string; date_modified: string };
export function listBundles(sql): BundleRow[];
export function getBundle(sql, id: number): BundleRow | null;
export function insertBundle(sql, input: BundleInput, now: string, order?: number): BundleRow;
export function updateBundle(sql, id: number, patch: Partial<BundleInput>, now: string): BundleRow;
export function deleteBundle(sql, id: number): boolean;
export function moveBundle(sql, id: number, direction: "up" | "down"): void;
export function bundleFilter(bundle: BundleRow): SearchFilter | null;
```
Invariant: `sort_order` values are `0..n-1` after every write. Test strategy: HTTP seam.

#### [MODIFIED] Bookmark queries, list rendering, page signals
`ListFilter.bundle`, `PageSignals.bundle`, sidebar section.

#### [NEW] Bundle pages and API (`src/ui/bundles.tsx`, `src/api/bundles.ts`)
Test strategy: HTTP seam.

## Sequence
1. Migration 5, queries, `bundleFilter`, bookmarks API `bundle` parameter and the composition outline.
2. Bundles API scenarios.
3. Pages: create, edit, delete, reorder.
4. Sidebar section, page filtering, page signal, actions.
5. Capability doc.
