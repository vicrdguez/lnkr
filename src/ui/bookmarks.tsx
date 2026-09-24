import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { assetCountsFor } from "../db/assets";
import { countBookmarks, LIST_SORTS, type ListFilter, selectBookmarks, tagCounts, tagNamesFor } from "../db/bookmarks";
import { type ListDefaults, type PageSignals, parsePageSignals } from "../lib/signals";
import { type Prefs, readPrefs, writePrefs } from "../prefs";
import { compileSearch, MATCH_NONE } from "../search";
import { snapshotsConfigured } from "../services/snapshots";
import { BookmarkPage, type Listing } from "../views/bookmark_list";
import { formFields } from "./form";

/** The bookmarks a list page shows; as in the API, a query that does not parse finds nothing rather than failing. */
export const listFilter = (archived: boolean, { q, unread }: PageSignals, prefs: Prefs): ListFilter => ({
  archived,
  unread,
  search: compileSearch(q, { laxTags: prefs.tag_search === "lax" }) ?? MATCH_NONE,
});

/** The saved search preferences as the list pages read them. */
export const listDefaults = ({ search_preferences: { sort, unread } }: Prefs): ListDefaults => ({ sort, unread: unread === "yes" });

/**
 * What the request decides about how items display: the Tenant's preferences, the favicon provider while Favicons
 * is on, the Snapshot button while configured.
 */
export type Display = Pick<Listing, "prefs" | "faviconProvider" | "snapshotButton">;
export const displayFor = (c: Context<AppEnv>): Display => {
  const prefs = readPrefs(c.get("user"));
  return {
    prefs,
    faviconProvider: prefs.enable_favicons ? c.env.LD_FAVICON_PROVIDER : null,
    snapshotButton: snapshotsConfigured(c.env),
  };
};

/** Everything the list page renders for `signals`, its links keeping `params`; a page past the end is the last page. */
export function listing(
  sql: SqlStorage,
  archived: boolean,
  signals: PageSignals,
  params: URLSearchParams,
  display: Display,
): Listing {
  const filter = listFilter(archived, signals, display.prefs);
  const count = countBookmarks(sql, filter);
  const perPage = display.prefs.items_per_page;
  const pages = Math.max(Math.ceil(count / perPage), 1);
  const page = Math.min(signals.page, pages);
  const { sort } = signals;
  const rows = selectBookmarks(sql, { ...filter, sort, limit: perPage, offset: (page - 1) * perPage });
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
  const display = displayFor(c);
  const signals = parsePageSignals(Object.fromEntries(params), listDefaults(display.prefs));
  const view = listing(c.get("sql"), archived, signals, params, display);
  return c.html(<BookmarkPage user={c.get("user")} {...view} />);
};

export const bookmarkPages = new Hono<AppEnv>();

bookmarkPages.get("/bookmarks", listPage(false));
bookmarkPages.get("/bookmarks/archived", listPage(true));

/** Saves the search form's sort and Unread filter as the defaults the list pages use when the query leaves them out. */
bookmarkPages.post("/bookmarks/search-preferences", async (c) => {
  const { sort, unread } = await formFields(c, "sort", "unread");
  writePrefs(c.get("sql"), c.get("user"), {
    search_preferences: { sort: LIST_SORTS.find((name) => name === sort) ?? "added_desc", shared: "off", unread: unread === "yes" ? "yes" : "off" },
  });
  return c.redirect("/bookmarks");
});
