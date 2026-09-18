export type TagRow = { id: number; name: string; date_added: string };

export function getTag(sql: SqlStorage, id: number): TagRow | null {
  return sql.exec<TagRow>("SELECT * FROM tags WHERE id = ?", id).toArray()[0] ?? null;
}

/** The tag named `name` in any case, created with that spelling when missing. */
export function ensureTag(sql: SqlStorage, name: string, now: string): TagRow {
  return (
    sql.exec<TagRow>("SELECT * FROM tags WHERE name = ?", name).toArray()[0] ??
    sql.exec<TagRow>("INSERT INTO tags (name, date_added) VALUES (?, ?) RETURNING *", name, now).one()
  );
}

export function listTags(sql: SqlStorage, limit: number, offset: number): { count: number; rows: TagRow[] } {
  return {
    count: sql.exec<{ n: number }>("SELECT count(*) AS n FROM tags").one().n,
    rows: sql.exec<TagRow>("SELECT * FROM tags ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?", limit, offset).toArray(),
  };
}

/** Up to `limit` names starting with `prefix`, none in `exclude`, both regardless of case, ordered by name regardless of case. */
export function suggestTags(sql: SqlStorage, prefix: string, exclude: string[], limit: number): string[] {
  const pattern = `${prefix.replace(/[\\%_]/g, "\\$&")}%`;
  return sql
    .exec<{ name: string }>(
      `SELECT name FROM tags WHERE name LIKE ? ESCAPE '\\'
       AND NOT EXISTS (SELECT 1 FROM json_each(?) WHERE value = tags.name COLLATE NOCASE)
       ORDER BY name COLLATE NOCASE LIMIT ?`,
      pattern, JSON.stringify(exclude), limit,
    )
    .toArray()
    .map((row) => row.name);
}

/** Detaches the tag from every bookmark and deletes it; false when no such tag. */
export function deleteTag(sql: SqlStorage, id: number): boolean {
  sql.exec("DELETE FROM bookmark_tags WHERE tag_id = ?", id);
  return sql.exec("DELETE FROM tags WHERE id = ?", id).rowsWritten > 0;
}

/** Trimmed, non-empty, deduplicated regardless of case keeping the first spelling. */
export function normalizeTagNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    result.push(name);
  }
  return result;
}
