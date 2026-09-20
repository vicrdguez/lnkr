import { Hono } from "hono";
import { pageParams } from "../api/envelope";
import type { AppEnv } from "../app";
import { type BookmarkRow, selectBookmarks } from "../db/bookmarks";
import { feedTokenExists } from "../db/tokens";
import { compileSearch, MATCH_NONE } from "../search";

/** Each feed kind with its channel title. */
const KINDS = { all: "All bookmarks", unread: "Unread bookmarks" };
export type FeedKind = keyof typeof KINDS;

/** The characters XML text cannot carry as they are: the four markup characters by reference, C0 controls dropped. */
const REFERENCES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const UNSAFE = /[&<>"\x00-\x08\x0B\x0C\x0E-\x1F]/g;

const xmlEscape = (text: string): string => text.replace(UNSAFE, (character) => REFERENCES[character] ?? "");

/** `<name>` holding `text`, escaped. */
const element = (name: string, text: string): string => `<${name}>${xmlEscape(text)}</${name}>`;

/** RSS 2.0 for `rows` in the order given; a Bookmark without a title is titled by its URL. */
export function renderRss(kind: FeedKind, origin: string, rows: BookmarkRow[]): string {
  const title = KINDS[kind];
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "<channel>",
    element("title", title),
    element("link", `${origin}/bookmarks`),
    element("description", title),
    ...rows.flatMap((row) => [
      "<item>",
      element("title", row.title || row.url),
      element("link", row.url),
      element("description", row.description),
      element("pubDate", new Date(row.date_added).toUTCString()),
      element("guid", row.url),
      "</item>",
    ]),
    "</channel>",
    "</rss>",
  ];
  return `${lines.join("\n")}\n`;
}

/** The Tenant's feeds, reachable with the feed token alone: no session and no CSRF. */
export const feeds = new Hono<AppEnv>();

// DEBT(#30/W1): Hono's TrieRouter compiles a trailing {all|unread} to ^all|unread$, unanchored, so /feeds/<token>/allx, /xunread and /all/extra serve a feed instead of 404; anchor the alternation.
feeds.get("/feeds/:token/:kind{all|unread}", (c) => {
  const kind = c.req.param("kind") as FeedKind;
  const sql = c.get("sql");
  if (!feedTokenExists(sql, c.req.param("token"))) return c.notFound();
  const rows = selectBookmarks(sql, {
    archived: false,
    unread: kind === "unread",
    // As in the API, a query that does not parse finds nothing rather than failing.
    search: compileSearch(c.req.query("q") ?? "") ?? MATCH_NONE,
    limit: pageParams(c).limit,
    offset: 0,
  });
  const xml = renderRss(kind, new URL(c.req.url).origin, rows);
  return c.body(xml, 200, { "content-type": "application/rss+xml; charset=utf-8" });
});
// Every other /feeds path, a missing token or an unknown kind included, ends here rather than at the login redirect.
feeds.all("/feeds/*", (c) => c.notFound());
