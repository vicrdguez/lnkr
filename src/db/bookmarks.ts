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

export type ListOptions = { archived: boolean; limit: number; offset: number; modifiedSince?: string; addedSince?: string };

/** One page of bookmarks newest first, with the total matching the filters. */
export function listBookmarks(sql: SqlStorage, options: ListOptions): { count: number; rows: BookmarkRow[] } {
  // Absent date filters compare against "", which every ISO timestamp exceeds.
  const where = "WHERE is_archived = ? AND date_modified >= ? AND date_added >= ?";
  const bindings = [+options.archived, options.modifiedSince ?? "", options.addedSince ?? ""];
  return {
    count: sql.exec<{ n: number }>(`SELECT count(*) AS n FROM bookmarks ${where}`, ...bindings).one().n,
    rows: sql
      .exec<BookmarkRow>(
        `SELECT * FROM bookmarks ${where} ORDER BY date_added DESC, id DESC LIMIT ? OFFSET ?`,
        ...bindings, options.limit, options.offset,
      )
      .toArray(),
  };
}
