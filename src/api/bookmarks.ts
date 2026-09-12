import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import {
  type BookmarkFields,
  EMPTY_BOOKMARK,
  findBookmarkByUrl,
  insertBookmark,
  listBookmarks,
  setTags,
  toFields,
  updateBookmark,
} from "../db/bookmarks";
import { fetchPageMetadata } from "../services/metadata";
import { pageParams, paginate } from "./envelope";
import { bookmarkJson, type FieldErrors, invalid, jsonBody, parseError } from "./serialize";

/** The writable fields a request body supplied. */
type Provided = Partial<BookmarkFields> & { tag_names?: string[] };
type Read = { fields: Provided; errors?: undefined } | { errors: FieldErrors; fields?: undefined };

const STRING_FIELDS = ["url", "title", "description", "notes"] as const;
const BOOLEAN_FIELDS = ["unread", "is_archived", "shared"] as const;

/** Validates the writable fields present in `body`; `url` is required unless `urlOptional`. */
function readFields(body: Record<string, unknown>, urlOptional = false): Read {
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

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** An ISO timestamp from the query parameter `name`, or undefined when absent or unparsable. */
function sinceParam(c: Context<AppEnv>, name: string): string | undefined {
  const time = Date.parse(c.req.query(name) ?? "");
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

export const bookmarks = new Hono<AppEnv>();

const list = (archived: boolean) => (c: Context<AppEnv>) => {
  const sql = c.get("sql");
  const { count, rows } = listBookmarks(sql, {
    archived,
    ...pageParams(c),
    modifiedSince: sinceParam(c, "modified_since"),
    addedSince: sinceParam(c, "added_since"),
  });
  // ponytail: one tag query per row; join and group when pages of 100 measurably drag.
  return c.json(paginate(c, count, rows.map((row) => bookmarkJson(sql, row))));
};
bookmarks.get("/bookmarks", list(false));
bookmarks.get("/bookmarks/archived", list(true));

/** Creates the bookmark, or updates the one that already has its URL; either way 201. */
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
  if (provided.tag_names) setTags(sql, row.id, provided.tag_names, now);
  return c.json(bookmarkJson(sql, row), 201);
});
