/** A Bookmark's stored file; a Snapshot is the only kind. `r2_key` names the object in `ASSETS_BUCKET`. */
export type AssetRow = {
  id: number;
  bookmark_id: number;
  asset_type: string;
  content_type: string;
  display_name: string;
  r2_key: string;
  file_size: number;
  status: "pending" | "complete" | "failure";
  date_created: string;
};

/** Inserts a pending HTML Snapshot of the Bookmark; its key is derived from the new id. */
export function insertAsset(sql: SqlStorage, bookmarkId: number, displayName: string, now: string): AssetRow {
  const { id } = sql
    .exec<{ id: number }>(
      `INSERT INTO assets (bookmark_id, content_type, display_name, r2_key, status, date_created)
       VALUES (?, 'text/html', ?, '', 'pending', ?) RETURNING id`,
      bookmarkId, displayName, now,
    )
    .one();
  return sql.exec<AssetRow>("UPDATE assets SET r2_key = ? WHERE id = ? RETURNING *", `snapshots/${bookmarkId}/${id}.html`, id).one();
}

export function completeAsset(sql: SqlStorage, id: number, fileSize: number): void {
  sql.exec("UPDATE assets SET status = 'complete', file_size = ? WHERE id = ?", fileSize, id);
}

export function failAsset(sql: SqlStorage, id: number): void {
  sql.exec("UPDATE assets SET status = 'failure' WHERE id = ?", id);
}

/** The Bookmark's Assets, newest first. */
export function listAssets(sql: SqlStorage, bookmarkId: number): AssetRow[] {
  return sql.exec<AssetRow>("SELECT * FROM assets WHERE bookmark_id = ? ORDER BY date_created DESC, id DESC", bookmarkId).toArray();
}

export function findAsset(sql: SqlStorage, id: number): AssetRow | null {
  return sql.exec<AssetRow>("SELECT * FROM assets WHERE id = ?", id).toArray()[0] ?? null;
}

/** How many Assets each of `ids` has, in one query; ids without any are absent. */
export function assetCountsFor(sql: SqlStorage, ids: number[]): Map<number, number> {
  return new Map(
    sql
      .exec<{ bookmark_id: number; n: number }>(
        "SELECT bookmark_id, count(*) AS n FROM assets WHERE bookmark_id IN (SELECT value FROM json_each(?)) GROUP BY bookmark_id",
        JSON.stringify(ids),
      )
      .toArray()
      .map((row) => [row.bookmark_id, row.n]),
  );
}

/** When the Tenant's newest Asset, of any Bookmark, was created; null before the first. */
export function newestAssetTime(sql: SqlStorage): string | null {
  return sql.exec<{ t: string | null }>("SELECT max(date_created) AS t FROM assets").one().t;
}

/** Deletes the Asset's row, moves its Bookmark's latest Snapshot on, then removes the stored file. */
export async function deleteAsset(sql: SqlStorage, bucket: R2Bucket, asset: AssetRow): Promise<void> {
  // Durable Object SQLite enforces foreign keys: the pointer goes before the row it names.
  sql.exec("UPDATE bookmarks SET latest_snapshot_id = NULL WHERE latest_snapshot_id = ?", asset.id);
  sql.exec("DELETE FROM assets WHERE id = ?", asset.id);
  refreshLatestSnapshot(sql, asset.bookmark_id);
  await deleteObjects(bucket, [asset.r2_key]);
}

/** Removes stored files once their rows are gone; a failure is logged, not surfaced. */
// ponytail: orphaned objects are cheap; a sweep can come later.
export async function deleteObjects(bucket: R2Bucket, keys: string[]): Promise<void> {
  if (!keys.length) return;
  try {
    await bucket.delete(keys);
  } catch (error) {
    console.warn("R2 delete failed", keys, error);
  }
}

/** Points the Bookmark at its newest complete Snapshot, or at none. */
export function refreshLatestSnapshot(sql: SqlStorage, bookmarkId: number): void {
  sql.exec(
    `UPDATE bookmarks SET latest_snapshot_id = (
       SELECT id FROM assets WHERE bookmark_id = ? AND status = 'complete' ORDER BY date_created DESC, id DESC LIMIT 1
     ) WHERE id = ?`,
    bookmarkId, bookmarkId,
  );
}
