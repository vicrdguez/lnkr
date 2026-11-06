import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import {
  type BookmarkFields,
  deleteBookmark,
  EMPTY_BOOKMARK,
  findBookmarkByUrl,
  getBookmark,
  insertBookmark,
  listBookmarks,
  setArchived,
  setTags,
  toFields,
  updateBookmark,
} from "../db/bookmarks";
import { bundleFilter, getBundle } from "../db/bundles";
import { positiveInt } from "../lib/signals";
import { isHttpUrl } from "../lib/url";
import { autoTagsFor, readPrefs } from "../prefs";
import { compileSearch, MATCH_NONE } from "../search";
import { fetchPageMetadata } from "../services/metadata";
import { pageParams, paginate } from "./envelope";
import { bookmarkJson, type FieldErrors, intParam, invalid, jsonBody, notFound, parseError } from "./serialize";

/** The writable fields a request body supplied. */
type Provided = Partial<BookmarkFields> & { tag_names?: string[] };
type FieldsResult = { fields: Provided; errors?: undefined } | { errors: FieldErrors; fields?: undefined };

const STRING_FIELDS = ["url", "title", "description", "notes"] as const;
const BOOLEAN_FIELDS = ["unread", "is_archived", "shared"] as const;

/** Validates the writable fields present in `body`; `url` is required unless `urlOptional`. */
function readFields(body: Record<string, unknown>, urlOptional = false): FieldsResult {
  const fields: Provided = {};
  const errors: FieldErrors = {};
  for (const key of STRING_FIELDS) {
    if (body[key] === undefined) continue;
    if (typeof body[key] === "string") fields[key] = body[key];
    else errors[key] = ["Invalid value."];
  }
  for (const key of BOOLEAN_FIELDS) {
    if (body[key] === undefined) continue;
    if (typeof body[key] === "boolean") fields[key] = body[key];
    else errors[key] = ["Invalid value."];
  }
  if (body.tag_names !== undefined) {
    if (Array.isArray(body.tag_names) && body.tag_names.every((name) => typeof name === "string")) {
      fields.tag_names = body.tag_names;
    } else errors.tag_names = ["Invalid value."];
  }
  if (fields.url !== undefined) {
    fields.url = fields.url.trim();
    if (!isHttpUrl(fields.url)) errors.url = ["Enter a valid URL."];
  } else if (!urlOptional && !errors.url) errors.url = ["This field is required."];
  return Object.keys(errors).length ? { errors } : { fields };
}

/** An ISO timestamp from the query parameter `name`, or undefined when absent or unparsable. */
function sinceParam(c: Context<AppEnv>, name: string): string | undefined {
  const time = Date.parse(c.req.query(name) ?? "");
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

export const bookmarks = new Hono<AppEnv>();

const list = (archived: boolean) => (c: Context<AppEnv>) => {
  const sql = c.get("sql");
  const page = pageParams(c);
  const search = compileSearch(c.req.query("q") ?? "", { laxTags: readPrefs(c.get("user")).tag_search === "lax" });
  // As in linkding, a query that does not parse finds nothing rather than failing.
  if (!search) return c.json({ count: 0, next: null, previous: null, results: [] });
  const bundleId = c.req.query("bundle");
  const bundle = bundleId === undefined ? undefined : getBundle(sql, positiveInt(bundleId) ?? -1);
  if (bundle === null) return invalid(c, { bundle: ["Invalid bundle."] });
  const { count, rows } = listBookmarks(sql, {
    archived,
    ...page,
    search,
    bundle: bundle && (bundleFilter(bundle) ?? MATCH_NONE),
    modifiedSince: sinceParam(c, "modified_since"),
    addedSince: sinceParam(c, "added_since"),
  });
  // ponytail: one tag query per row; join and group when pages of 100 measurably drag.
  return c.json(paginate(c, page, count, rows.map((row) => bookmarkJson(sql, row))));
};
bookmarks.get("/bookmarks", list(false));
// Fixed paths come before the :id routes so they are never read as ids.
bookmarks.get("/bookmarks/archived", list(true));

/** The existing bookmark for `url`, the page's metadata, fetched even when the bookmark exists, and the auto tags. */
bookmarks.get("/bookmarks/check", async (c) => {
  const url = c.req.query("url")?.trim();
  if (!url) return invalid(c, { url: ["This field is required."] });
  if (!isHttpUrl(url)) return invalid(c, { url: ["Enter a valid URL."] });
  const metadata = await fetchPageMetadata(url);
  const sql = c.get("sql");
  const existing = findBookmarkByUrl(sql, url);
  return c.json({ bookmark: existing ? bookmarkJson(sql, existing) : null, metadata, auto_tags: autoTagsFor(c.get("user"), url) });
});

/**
 * Creates the bookmark with its auto tags added to the submitted ones, or updates the one that already has its URL,
 * adding none; either way 201. `disable_html_snapshot` in the query is accepted and ignored: Snapshots are only ever
 * taken by hand.
 */
bookmarks.post("/bookmarks", async (c) => {
  const body = await jsonBody(c);
  if (!body) return parseError(c);
  const { fields: provided, errors } = readFields(body);
  if (errors) return invalid(c, errors);
  const url = provided.url as string;
  const scrape = c.req.query("disable_scraping") === undefined && (!provided.title || !provided.description);
  // The only await before storage is touched, so the find-or-update below cannot interleave.
  const page = scrape ? await fetchPageMetadata(url) : null;

  const sql = c.get("sql");
  const now = new Date().toISOString();
  const existing = findBookmarkByUrl(sql, url);
  const fields: BookmarkFields = { ...(existing ? toFields(existing) : EMPTY_BOOKMARK), ...provided };
  fields.title ||= page?.title ?? "";
  fields.description ||= page?.description ?? "";
  const row = existing ? updateBookmark(sql, existing.id, fields, now) : insertBookmark(sql, fields, now);
  const tagNames = existing ? provided.tag_names : [...(provided.tag_names ?? []), ...autoTagsFor(c.get("user"), url)];
  if (tagNames) setTags(sql, row.id, tagNames, now);
  return c.json(bookmarkJson(sql, row), 201);
});

bookmarks.get("/bookmarks/:id", (c) => {
  const sql = c.get("sql");
  const row = getBookmark(sql, intParam(c, "id"));
  return row ? c.json(bookmarkJson(sql, row)) : notFound(c);
});

/** PUT replaces every writable field with defaults for omitted ones; PATCH keeps what the body omits. */
async function update(c: Context<AppEnv>, patch: boolean) {
  const body = await jsonBody(c);
  if (!body) return parseError(c);
  const sql = c.get("sql");
  const existing = getBookmark(sql, intParam(c, "id"));
  if (!existing) return notFound(c);
  const { fields: provided, errors } = readFields(body, patch);
  if (errors) return invalid(c, errors);
  const fields: BookmarkFields = { ...(patch ? toFields(existing) : EMPTY_BOOKMARK), ...provided };
  const owner = findBookmarkByUrl(sql, fields.url);
  if (owner && owner.id !== existing.id) return invalid(c, { url: ["A bookmark with this URL already exists."] });
  const now = new Date().toISOString();
  const row = updateBookmark(sql, existing.id, fields, now);
  const tagNames = provided.tag_names ?? (patch ? undefined : []);
  if (tagNames) setTags(sql, row.id, tagNames, now);
  return c.json(bookmarkJson(sql, row));
}
bookmarks.put("/bookmarks/:id", (c) => update(c, false));
bookmarks.patch("/bookmarks/:id", (c) => update(c, true));

bookmarks.delete("/bookmarks/:id", async (c) =>
  (await deleteBookmark(c.get("sql"), c.env.ASSETS_BUCKET, intParam(c, "id"))) ? c.body(null, 204) : notFound(c),
);

const archive = (archived: boolean) => (c: Context<AppEnv>) =>
  setArchived(c.get("sql"), intParam(c, "id"), archived, new Date().toISOString()) ? c.body(null, 204) : notFound(c);
bookmarks.post("/bookmarks/:id/archive", archive(true));
bookmarks.post("/bookmarks/:id/unarchive", archive(false));
