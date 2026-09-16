import { MATCH_ALL, type SearchFilter } from "../search";
import { ensureTag, normalizeTagNames } from "./tags";

export type BookmarkRow = {
  id: number;
  url: string;
  title: string;
  description: string;
  notes: string;
  unread: number;
  is_archived: number;
  shared: number;
  date_added: string;
  date_modified: string;
};

/** Every writable field; booleans here, integers in the row. */
export type BookmarkFields = {
  url: string;
  title: string;
  description: string;
  notes: string;
  unread: boolean;
  is_archived: boolean;
  shared: boolean;
};

export const EMPTY_BOOKMARK: BookmarkFields = {
  url: "",
  title: "",
  description: "",
  notes: "",
  unread: false,
  is_archived: false,
  shared: false,
};

export const toFields = (row: BookmarkRow): BookmarkFields => ({
  url: row.url,
  title: row.title,
  description: row.description,
  notes: row.notes,
  unread: !!row.unread,
  is_archived: !!row.is_archived,
  shared: !!row.shared,
});

export function findBookmarkByUrl(sql: SqlStorage, url: string): BookmarkRow | null {
  return sql.exec<BookmarkRow>("SELECT * FROM bookmarks WHERE url = ?", url).toArray()[0] ?? null;
}

export function getBookmark(sql: SqlStorage, id: number): BookmarkRow | null {
  return sql.exec<BookmarkRow>("SELECT * FROM bookmarks WHERE id = ?", id).toArray()[0] ?? null;
}

export function insertBookmark(sql: SqlStorage, fields: BookmarkFields, now: string): BookmarkRow {
  const { url, title, description, notes, unread, is_archived, shared } = fields;
  return sql
    .exec<BookmarkRow>(
      `INSERT INTO bookmarks (url, title, description, notes, unread, is_archived, shared, date_added, date_modified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      url, title, description, notes, +unread, +is_archived, +shared, now, now,
    )
    .one();
}

/** Replaces every writable field and bumps `date_modified`. */
export function updateBookmark(sql: SqlStorage, id: number, fields: BookmarkFields, now: string): BookmarkRow {
  const { url, title, description, notes, unread, is_archived, shared } = fields;
  return sql
    .exec<BookmarkRow>(
      `UPDATE bookmarks SET url = ?, title = ?, description = ?, notes = ?, unread = ?, is_archived = ?, shared = ?,
       date_modified = ? WHERE id = ? RETURNING *`,
      url, title, description, notes, +unread, +is_archived, +shared, now, id,
    )
    .one();
}

/** Deletes the bookmark and its tag attachments; false when no such bookmark. */
export function deleteBookmark(sql: SqlStorage, id: number): boolean {
  sql.exec("DELETE FROM bookmark_tags WHERE bookmark_id = ?", id);
  return sql.exec("DELETE FROM bookmarks WHERE id = ?", id).rowsWritten > 0;
}

export function setArchived(sql: SqlStorage, id: number, archived: boolean, now: string): boolean {
  return (
    sql.exec("UPDATE bookmarks SET is_archived = ?, date_modified = ? WHERE id = ?", +archived, now, id).rowsWritten > 0
  );
}

/** Replaces the bookmark's tags wholesale, creating tags that do not exist yet. */
export function setTags(sql: SqlStorage, id: number, names: string[], now: string): void {
  sql.exec("DELETE FROM bookmark_tags WHERE bookmark_id = ?", id);
  for (const name of normalizeTagNames(names)) {
    sql.exec("INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)", id, ensureTag(sql, name, now).id);
  }
}

/** Tag names of the bookmark, ordered by name regardless of case. */
export function tagNamesOf(sql: SqlStorage, id: number): string[] {
  return sql
    .exec<{ name: string }>(
      "SELECT t.name FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.bookmark_id = ? ORDER BY t.name COLLATE NOCASE",
      id,
    )
    .toArray()
    .map((row) => row.name);
}

const ORDER = {
  added_desc: "b.date_added DESC, b.id DESC",
  added_asc: "b.date_added ASC, b.id ASC",
  title_asc: "b.title COLLATE NOCASE ASC, b.id ASC",
  title_desc: "b.title COLLATE NOCASE DESC, b.id DESC",
};
export type ListSort = keyof typeof ORDER;
/** Every sort name, the default `added_desc` first. */
export const LIST_SORTS = Object.keys(ORDER) as ListSort[];

export type ListFilter = {
  archived: boolean;
  unread?: boolean;
  search?: SearchFilter;
  modifiedSince?: string;
  addedSince?: string;
};

/** The `WHERE` over the alias `b` for `filter`, shared by the list, its count and the tag sidebar so they never disagree. */
function whereFor(filter: ListFilter): { where: string; params: (string | number)[] } {
  const search = filter.search ?? MATCH_ALL;
  // Absent date filters compare against "", which every ISO timestamp exceeds.
  const conditions = ["b.is_archived = ?", search.where, "b.date_modified >= ?", "b.date_added >= ?"];
  if (filter.unread) conditions.push("b.unread = 1");
  return {
    where: `WHERE ${conditions.join(" AND ")}`,
    params: [+filter.archived, ...search.params, filter.modifiedSince ?? "", filter.addedSince ?? ""],
  };
}

export function countBookmarks(sql: SqlStorage, filter: ListFilter): number {
  const { where, params } = whereFor(filter);
  return sql.exec<{ n: number }>(`SELECT count(*) AS n FROM bookmarks b ${where}`, ...params).one().n;
}

export type PageOptions = ListFilter & { limit: number; offset: number; sort?: ListSort };

/** One page of bookmarks, newest first unless `sort` says otherwise. */
export function selectBookmarks(sql: SqlStorage, options: PageOptions): BookmarkRow[] {
  const { where, params } = whereFor(options);
  return sql
    .exec<BookmarkRow>(
      `SELECT b.* FROM bookmarks b ${where} ORDER BY ${ORDER[options.sort ?? "added_desc"]} LIMIT ? OFFSET ?`,
      ...params, options.limit, options.offset,
    )
    .toArray();
}

/** One page of bookmarks with the total matching the filters. */
export function listBookmarks(sql: SqlStorage, options: PageOptions): { count: number; rows: BookmarkRow[] } {
  return { count: countBookmarks(sql, options), rows: selectBookmarks(sql, options) };
}

/** Every tag on a bookmark matching `filter` with how many of those bookmarks carry it, ordered by name regardless of case. */
export function tagCounts(sql: SqlStorage, filter: ListFilter): { name: string; count: number }[] {
  const { where, params } = whereFor(filter);
  return sql
    .exec<{ name: string; count: number }>(
      `SELECT t.name AS name, count(*) AS count FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
       WHERE bt.bookmark_id IN (SELECT b.id FROM bookmarks b ${where}) GROUP BY t.id ORDER BY t.name COLLATE NOCASE`,
      ...params,
    )
    .toArray();
}

/** The tag names of each of `ids` in one query, ordered by name regardless of case; ids without tags are absent. */
export function tagNamesFor(sql: SqlStorage, ids: number[]): Map<number, string[]> {
  const names = new Map<number, string[]>();
  const rows = sql
    .exec<{ bookmark_id: number; name: string }>(
      `SELECT bt.bookmark_id, t.name FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
       WHERE bt.bookmark_id IN (SELECT value FROM json_each(?)) ORDER BY t.name COLLATE NOCASE`,
      JSON.stringify(ids),
    )
    .toArray();
  for (const row of rows) names.set(row.bookmark_id, [...(names.get(row.bookmark_id) ?? []), row.name]);
  return names;
}
