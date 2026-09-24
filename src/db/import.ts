import { isHttpUrl } from "../lib/url";
import type { Entry } from "../services/netscape";
import { bulkAddTags, findBookmarkByUrl, insertBookmark, setTags, updateBookmark } from "./bookmarks";

export type ImportCounts = { created: number; updated: number; skipped: number };

/**
 * Writes each entry: a new URL is inserted with the entry's dates, an existing one takes the entry's fields and
 * the union of the tags and is modified `now`; an entry whose URL is not http(s) is skipped. An entry without
 * `shared` leaves an existing Bookmark's flag as it is and creates a Bookmark that is not Shared.
 */
export function importEntries(sql: SqlStorage, entries: Entry[], now: string): ImportCounts {
  const counts: ImportCounts = { created: 0, updated: 0, skipped: 0 };
  // ponytail: a handful of statements per entry; batch through json_each if imports of many thousands drag.
  for (const { dateAdded, dateModified, tags, shared, ...fields } of entries) {
    if (!isHttpUrl(fields.url)) {
      counts.skipped++;
      continue;
    }
    const existing = findBookmarkByUrl(sql, fields.url);
    if (existing) {
      updateBookmark(sql, existing.id, { ...fields, shared: shared ?? !!existing.shared }, now);
      bulkAddTags(sql, [existing.id], tags, now);
      counts.updated++;
    } else {
      const row = insertBookmark(sql, { ...fields, shared: shared ?? false }, dateAdded, dateModified);
      setTags(sql, row.id, tags, now);
      counts.created++;
    }
  }
  return counts;
}
