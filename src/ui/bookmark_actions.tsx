import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { isDatastar, readSignals, requireDatastar, sse, text } from "../datastar";
import { assetCountsFor } from "../db/assets";
import {
  bulkAddTags,
  bulkDelete,
  bulkRemoveTags,
  bulkSetArchived,
  bulkSetUnread,
  getBookmark,
  idsMatching,
  tagNamesOf,
} from "../db/bookmarks";
import { pageParams, parsePageSignals } from "../lib/signals";
import { takeSnapshot } from "../services/snapshots";
import { BookmarkItem, ListFragments, linkTo } from "../views/bookmark_list";
import { displayFor, listFilter, listing } from "./bookmarks";

/** What an action may need: storage, the moment, and the tag names typed into the bulk bar. */
type Deps = { sql: SqlStorage; bucket: R2Bucket; now: string; names: string[] };
type Apply = (deps: Deps, ids: number[]) => void | Promise<void>;

export type Action = "archive" | "unarchive" | "delete" | "read" | "unread" | "tag" | "untag";

/** Every action by the name the bulk bar sends. */
const ACTIONS: Record<Action, Apply> = {
  archive: ({ sql, now }, ids) => bulkSetArchived(sql, ids, true, now),
  unarchive: ({ sql, now }, ids) => bulkSetArchived(sql, ids, false, now),
  delete: ({ sql, bucket }, ids) => bulkDelete(sql, bucket, ids),
  read: ({ sql, now }, ids) => bulkSetUnread(sql, ids, false, now),
  unread: ({ sql, now }, ids) => bulkSetUnread(sql, ids, true, now),
  tag: ({ sql, now, names }, ids) => bulkAddTags(sql, ids, names, now),
  untag: ({ sql, now, names }, ids) => bulkRemoveTags(sql, ids, names, now),
};

const depsFor = (c: Context<AppEnv>, names: string[] = []): Deps => ({
  sql: c.get("sql"),
  bucket: c.env.ASSETS_BUCKET,
  now: new Date().toISOString(),
  names,
});
/** The actions an item's own buttons offer. */
export const ITEM_ACTIONS = ["archive", "unarchive", "delete", "read"] as const satisfies readonly Action[];
export type ItemAction = (typeof ITEM_ACTIONS)[number];

/** Own names only: the client's string must not reach `toString` and friends. */
const isAction = (name: unknown): name is Action => typeof name === "string" && Object.hasOwn(ACTIONS, name);

/** The ids behind the `selected` signal: keys `b<id>` whose value is true. */
const selectedIds = (selected: unknown): number[] =>
  Object.entries(selected && typeof selected === "object" ? selected : {}).flatMap(([key, on]) =>
    on === true && /^b\d+$/.test(key) ? [Number(key.slice(1))] : [],
  );

/**
 * Re-renders the page the signals describe and streams the list and sidebar, plus the bulk bar after a bulk action;
 * patches `page` when the change left it past the end, and after a bulk action resets the selection.
 */
function respond(c: Context<AppEnv>, raw: Record<string, unknown>, bulk: boolean): Response {
  const signals = parsePageSignals(raw);
  const view = listing(c.get("sql"), raw.archived === true, signals, pageParams(signals), displayFor(c));
  return sse((stream) => {
    stream.patchElements(String(<ListFragments {...view} bulkBar={bulk} />));
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

bookmarkActions.post(`/bookmarks/:id{[0-9]+}/:action{${ITEM_ACTIONS.join("|")}}`, requireDatastar, async (c) => {
  const signals = await readSignals(c);
  if (!signals) return c.text("JSON body required", 400);
  const sql = c.get("sql");
  const id = Number(c.req.param("id"));
  if (!getBookmark(sql, id)) return c.notFound();
  await ACTIONS[c.req.param("action") as ItemAction](depsFor(c), [id]);
  return respond(c, signals, false);
});

/**
 * Applies `action` to the selected ids or, with `selectAcross`, to every bookmark the page's filter matches. A
 * selected id that no longer belongs to the page's list, archived or deleted since, is left alone.
 */
bookmarkActions.post("/bookmarks/bulk", requireDatastar, async (c) => {
  const signals = await readSignals(c);
  if (!signals) return c.text("JSON body required", 400);
  if (!isAction(signals.action)) return c.text("Unknown action", 400);
  const sql = c.get("sql");
  const archived = signals.archived === true;
  const ids = idsMatching(
    sql,
    signals.selectAcross === true
      ? listFilter(sql, archived, parsePageSignals(signals))
      : { archived, ids: selectedIds(signals.selected) },
  );
  if (ids.length) await ACTIONS[signals.action](depsFor(c, text(signals.bulkTags).split(/\s+/)), ids);
  return respond(c, signals, true);
});

/**
 * Takes a Snapshot of the Bookmark. From Datastar it streams the item re-rendered, its message slot saying why no
 * Snapshot was stored when so; a failed render is still 200 because the client ignores other bodies. A plain form
 * post lands back on the list once the render is over.
 */
bookmarkActions.post("/bookmarks/:id{[0-9]+}/snapshot", async (c) => {
  const signals = isDatastar(c) ? await readSignals(c) : null;
  if (isDatastar(c) && !signals) return c.text("JSON body required", 400);
  const sql = c.get("sql");
  const id = Number(c.req.param("id"));
  const row = getBookmark(sql, id);
  if (!row) return c.notFound();
  const now = new Date().toISOString();
  if (!signals) {
    await takeSnapshot(sql, c.env, row, now);
    return c.redirect(row.is_archived ? "/bookmarks/archived" : "/bookmarks");
  }
  const archived = signals.archived === true;
  const link = linkTo({ archived, params: pageParams(parsePageSignals(signals)) });
  const display = displayFor(c);
  return sse(async (stream) => {
    const message = (await takeSnapshot(sql, c.env, row, now)) ?? undefined;
    const fresh = getBookmark(sql, id);
    if (!fresh) return;
    const snapshots = assetCountsFor(sql, [id]).get(id) ?? 0;
    const tags = tagNamesOf(sql, id);
    stream.patchElements(
      String(
        <BookmarkItem row={fresh} tags={tags} snapshots={snapshots} archived={archived} link={link} now={Date.now()} message={message} {...display} />,
      ),
    );
  });
});
