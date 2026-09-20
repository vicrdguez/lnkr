import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { assetCountsFor } from "../db/assets";
import { countBookmarks, type ListFilter, selectBookmarks, tagCounts, tagNamesFor } from "../db/bookmarks";
import { type PageSignals, parsePageSignals } from "../lib/signals";
import { readPrefs } from "../prefs";
import { compileSearch, MATCH_NONE } from "../search";
import { snapshotsConfigured } from "../services/snapshots";
import { BookmarkPage, type Listing } from "../views/bookmark_list";

export const ITEMS_PER_PAGE = 30;

/** The bookmarks a list page shows; as in the API, a query that does not parse finds nothing rather than failing. */
export const listFilter = (archived: boolean, { q, unread }: PageSignals): ListFilter => ({
  archived,
  unread,
  search: compileSearch(q) ?? MATCH_NONE,
});

/** What the request decides about how items display: the favicon provider while Favicons is on, the Snapshot button while configured. */
export type Display = Pick<Listing, "faviconProvider" | "snapshotButton">;
export const displayFor = (c: Context<AppEnv>): Display => ({
  faviconProvider: readPrefs(c.get("user")).enable_favicons ? c.env.LD_FAVICON_PROVIDER : null,
  snapshotButton: snapshotsConfigured(c.env),
});

/** Everything the list page renders for `signals`, its links keeping `params`; a page past the end is the last page. */
export function listing(
  sql: SqlStorage,
  archived: boolean,
  signals: PageSignals,
  params: URLSearchParams,
  display: Display,
): Listing {
  const filter = listFilter(archived, signals);
  const count = countBookmarks(sql, filter);
  const pages = Math.max(Math.ceil(count / ITEMS_PER_PAGE), 1);
  const page = Math.min(signals.page, pages);
  const { sort } = signals;
  const rows = selectBookmarks(sql, { ...filter, sort, limit: ITEMS_PER_PAGE, offset: (page - 1) * ITEMS_PER_PAGE });
  const ids = rows.map((row) => row.id);
  const names = tagNamesFor(sql, ids);
  const snapshots = assetCountsFor(sql, ids);
  return {
    ...signals,
    archived,
    params,
    page,
    pages,
    items: rows.map((row) => ({ row, tags: names.get(row.id) ?? [], snapshots: snapshots.get(row.id) ?? 0 })),
    tags: tagCounts(sql, filter),
    empty: count ? null : countBookmarks(sql, { archived }) ? "No bookmarks found" : "No bookmarks yet",
    now: Date.now(),
    ...display,
  };
}

const listPage = (archived: boolean) => (c: Context<AppEnv>) => {
  const params = new URL(c.req.url).searchParams;
  const signals = parsePageSignals(Object.fromEntries(params));
  const view = listing(c.get("sql"), archived, signals, params, displayFor(c));
  return c.html(<BookmarkPage user={c.get("user")} {...view} />);
};

export const bookmarkPages = new Hono<AppEnv>();

bookmarkPages.get("/bookmarks", listPage(false));
bookmarkPages.get("/bookmarks/archived", listPage(true));
