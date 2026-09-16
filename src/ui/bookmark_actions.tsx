import { Hono } from "hono";
import type { AppEnv } from "../app";
import { readSignals, requireDatastar, sse, text } from "../datastar";
import {
  bulkAddTags,
  bulkDelete,
  bulkRemoveTags,
  bulkSetArchived,
  bulkSetUnread,
  getBookmark,
  idsMatching,
} from "../db/bookmarks";
import { parsePageSignals } from "../lib/signals";
import { ListFragments } from "../views/bookmark_list";
import { listFilter, listing } from "./bookmarks";

type Apply = (sql: SqlStorage, ids: number[], now: string, names: string[]) => void;

/** Every action by the name the bulk bar sends; the per-item routes use the first four. */
const ACTIONS: Record<string, Apply> = {
  archive: (sql, ids, now) => bulkSetArchived(sql, ids, true, now),
  unarchive: (sql, ids, now) => bulkSetArchived(sql, ids, false, now),
  delete: (sql, ids) => bulkDelete(sql, ids),
  read: (sql, ids, now) => bulkSetUnread(sql, ids, false, now),
  unread: (sql, ids, now) => bulkSetUnread(sql, ids, true, now),
  tag: (sql, ids, now, names) => bulkAddTags(sql, ids, names, now),
  untag: (sql, ids, now, names) => bulkRemoveTags(sql, ids, names, now),
};

/** The ids behind the `selected` signal: keys `b<id>` whose value is true. */
const selectedIds = (selected: unknown): number[] =>
  Object.entries(selected && typeof selected === "object" ? selected : {}).flatMap(([key, on]) =>
    on === true && /^b\d+$/.test(key) ? [Number(key.slice(1))] : [],
  );

/**
 * Re-renders the page the signals describe and streams every fragment; patches `page` when the change left it past
 * the end, and after a bulk action resets the selection.
 */
function respond(sql: SqlStorage, raw: Record<string, unknown>, bulk: boolean): Response {
  const signals = parsePageSignals(raw);
  const view = listing(sql, raw.archived === true, signals);
  return sse((stream) => {
    stream.patchElements(String(<ListFragments {...view} />));
    const patch: Record<string, unknown> = view.page === signals.page ? {} : { page: view.page };
    if (bulk) {
      // A merge patch leaves an empty object as it is, so the map is dropped before it is declared empty again.
      stream.patchSignals(JSON.stringify({ selected: null }));
      Object.assign(patch, { selected: {}, selectAcross: false, bulkTags: "" });
    }
    if (Object.keys(patch).length) stream.patchSignals(JSON.stringify(patch));
  });
}

export const bookmarkActions = new Hono<AppEnv>();

bookmarkActions.post("/bookmarks/:id{[0-9]+}/:action{archive|unarchive|delete|read}", requireDatastar, async (c) => {
  const signals = await readSignals(c);
  if (!signals) return c.text("JSON body required", 400);
  const sql = c.get("sql");
  const id = Number(c.req.param("id"));
  if (!getBookmark(sql, id)) return c.notFound();
  ACTIONS[c.req.param("action")](sql, [id], new Date().toISOString(), []);
  return respond(sql, signals, false);
});

/** Applies `action` to the selected ids or, with `selectAcross`, to every bookmark the page's filter matches. */
bookmarkActions.post("/bookmarks/bulk", requireDatastar, async (c) => {
  const signals = await readSignals(c);
  if (!signals) return c.text("JSON body required", 400);
  const apply = typeof signals.action === "string" ? ACTIONS[signals.action] : undefined;
  if (!apply) return c.text("Unknown action", 400);
  const sql = c.get("sql");
  const archived = signals.archived === true;
  const ids = signals.selectAcross === true
    ? idsMatching(sql, listFilter(archived, parsePageSignals(signals)))
    : selectedIds(signals.selected);
  if (ids.length) apply(sql, ids, new Date().toISOString(), text(signals.bulkTags).split(/\s+/));
  return respond(sql, signals, true);
});
