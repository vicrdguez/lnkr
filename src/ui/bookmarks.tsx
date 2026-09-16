import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { countBookmarks, LIST_SORTS, selectBookmarks, tagCounts, tagNamesFor } from "../db/bookmarks";
import { compileSearch, MATCH_NONE } from "../search";
import { BookmarkPage } from "../views/bookmark_list";

export const ITEMS_PER_PAGE = 30;

const listPage = (archived: boolean) => (c: Context<AppEnv>) => {
  const sql = c.get("sql");
  const params = new URL(c.req.url).searchParams;
  const q = params.get("q") ?? "";
  const sort = LIST_SORTS.find((name) => name === params.get("sort")) ?? "added_desc";
  const unread = params.get("unread") === "yes";
  // As in the API, a query that does not parse finds nothing rather than failing.
  const filter = { archived, unread, search: compileSearch(q) ?? MATCH_NONE };
  const count = countBookmarks(sql, filter);
  const pages = Math.max(Math.ceil(count / ITEMS_PER_PAGE), 1);
  // A page past the end shows the last page.
  const page = Math.min(Math.max(parseInt(params.get("page") ?? "", 10) || 1, 1), pages);
  const rows = selectBookmarks(sql, { ...filter, sort, limit: ITEMS_PER_PAGE, offset: (page - 1) * ITEMS_PER_PAGE });
  const names = tagNamesFor(sql, rows.map((row) => row.id));
  return c.html(
    <BookmarkPage
      user={c.get("user")}
      archived={archived}
      path={c.req.path}
      params={params}
      q={q}
      sort={sort}
      unread={unread}
      items={rows.map((row) => ({ row, tags: names.get(row.id) ?? [] }))}
      page={page}
      pages={pages}
      tags={tagCounts(sql, filter)}
      empty={count ? null : countBookmarks(sql, { archived }) ? "No bookmarks found" : "No bookmarks yet"}
      now={Date.now()}
    />,
  );
};

export const bookmarkPages = new Hono<AppEnv>();

bookmarkPages.get("/bookmarks", listPage(false));
bookmarkPages.get("/bookmarks/archived", listPage(true));
