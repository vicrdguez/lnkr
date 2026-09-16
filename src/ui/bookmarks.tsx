import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { countBookmarks, type ListFilter, selectBookmarks, tagCounts, tagNamesFor } from "../db/bookmarks";
import { type PageSignals, parsePageSignals } from "../lib/signals";
import { compileSearch, MATCH_NONE } from "../search";
import { BookmarkPage, type Listing } from "../views/bookmark_list";

export const ITEMS_PER_PAGE = 30;

/** The bookmarks a list page shows; as in the API, a query that does not parse finds nothing rather than failing. */
export const listFilter = (archived: boolean, { q, unread }: PageSignals): ListFilter => ({
  archived,
  unread,
  search: compileSearch(q) ?? MATCH_NONE,
});

/** Everything the list page renders for `signals`; a page past the end is the last page. */
export function listing(sql: SqlStorage, archived: boolean, signals: PageSignals): Listing {
  const filter = listFilter(archived, signals);
  const count = countBookmarks(sql, filter);
  const pages = Math.max(Math.ceil(count / ITEMS_PER_PAGE), 1);
  const page = Math.min(signals.page, pages);
  const { sort } = signals;
  const rows = selectBookmarks(sql, { ...filter, sort, limit: ITEMS_PER_PAGE, offset: (page - 1) * ITEMS_PER_PAGE });
  const names = tagNamesFor(sql, rows.map((row) => row.id));
  return {
    ...signals,
    archived,
    page,
    pages,
    items: rows.map((row) => ({ row, tags: names.get(row.id) ?? [] })),
    tags: tagCounts(sql, filter),
    empty: count ? null : countBookmarks(sql, { archived }) ? "No bookmarks found" : "No bookmarks yet",
    now: Date.now(),
  };
}

const listPage = (archived: boolean) => (c: Context<AppEnv>) => {
  const signals = parsePageSignals(Object.fromEntries(new URL(c.req.url).searchParams));
  return c.html(<BookmarkPage user={c.get("user")} {...listing(c.get("sql"), archived, signals)} />);
};

export const bookmarkPages = new Hono<AppEnv>();

bookmarkPages.get("/bookmarks", listPage(false));
bookmarkPages.get("/bookmarks/archived", listPage(true));
