import { compileSearch, type SearchFilter, TAG_EXISTS } from "../search";
import { normalizeTagNames } from "./tags";

export type BundleRow = {
  id: number;
  name: string;
  search: string;
  any_tags: string;
  all_tags: string;
  excluded_tags: string;
  /** The position in the sidebar: `0..n-1`, dense after every write. */
  sort_order: number;
  date_created: string;
  date_modified: string;
};

/** The text a Bundle is made of; its position is kept apart as `sort_order`. */
export type BundleInput = Pick<BundleRow, "name" | "search" | "any_tags" | "all_tags" | "excluded_tags">;

export const EMPTY_BUNDLE: BundleInput = { name: "", search: "", any_tags: "", all_tags: "", excluded_tags: "" };

/** Every Bundle in sidebar order. */
export function listBundles(sql: SqlStorage): BundleRow[] {
  return sql.exec<BundleRow>("SELECT * FROM bundles ORDER BY sort_order, id").toArray();
}

export function getBundle(sql: SqlStorage, id: number): BundleRow | null {
  return sql.exec<BundleRow>("SELECT * FROM bundles WHERE id = ?", id).toArray()[0] ?? null;
}

const readBundle = (sql: SqlStorage, id: number): BundleRow =>
  sql.exec<BundleRow>("SELECT * FROM bundles WHERE id = ?", id).one();

/** Inserts the Bundle last, or at position `order` when given; `date_modified` starts equal to `date_created`. */
export function insertBundle(sql: SqlStorage, input: BundleInput, now: string, order?: number): BundleRow {
  const { name, search, any_tags, all_tags, excluded_tags } = input;
  const count = sql.exec<{ n: number }>("SELECT count(*) AS n FROM bundles").one().n;
  const { id } = sql
    .exec<{ id: number }>(
      `INSERT INTO bundles (name, search, any_tags, all_tags, excluded_tags, sort_order, date_created, date_modified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      name, search, any_tags, all_tags, excluded_tags, count, now, now,
    )
    .one();
  if (order !== undefined) placeBundle(sql, id, order);
  return readBundle(sql, id);
}

/** Replaces the given text fields, bumps `date_modified`, and moves the Bundle to position `order` when given. */
export function updateBundle(sql: SqlStorage, id: number, patch: Partial<BundleInput>, now: string, order?: number): BundleRow {
  const { name, search, any_tags, all_tags, excluded_tags } = { ...readBundle(sql, id), ...patch };
  sql.exec(
    `UPDATE bundles SET name = ?, search = ?, any_tags = ?, all_tags = ?, excluded_tags = ?, date_modified = ? WHERE id = ?`,
    name, search, any_tags, all_tags, excluded_tags, now, id,
  );
  if (order !== undefined) placeBundle(sql, id, order);
  return readBundle(sql, id);
}

/** Deletes the Bundle and closes the gap in `sort_order`; false when no such Bundle. */
export function deleteBundle(sql: SqlStorage, id: number): boolean {
  if (sql.exec("DELETE FROM bundles WHERE id = ?", id).rowsWritten === 0) return false;
  renumber(sql, orderedIds(sql));
  return true;
}

/** Swaps the Bundle with its neighbour in `direction`; at either end nothing moves. False when no such Bundle. */
export function moveBundle(sql: SqlStorage, id: number, direction: "up" | "down"): boolean {
  const row = getBundle(sql, id);
  if (!row) return false;
  placeBundle(sql, id, row.sort_order + (direction === "up" ? -1 : 1));
  return true;
}

const orderedIds = (sql: SqlStorage): number[] =>
  sql.exec<{ id: number }>("SELECT id FROM bundles ORDER BY sort_order, id").toArray().map((row) => row.id);

/** Writes `sort_order` `0..n-1` over `ids` in that order. */
// ponytail: one UPDATE per Bundle on every reorder; fine for the handful a sidebar holds.
function renumber(sql: SqlStorage, ids: number[]): void {
  ids.forEach((id, index) => sql.exec("UPDATE bundles SET sort_order = ? WHERE id = ?", index, id));
}

/** Puts Bundle `id` at position `order` among the others, clamped to the ends, keeping the sequence dense. */
function placeBundle(sql: SqlStorage, id: number, order: number): void {
  const ids = orderedIds(sql).filter((other) => other !== id);
  ids.splice(Math.min(Math.max(order, 0), ids.length), 0, id);
  renumber(sql, ids);
}

/** The names in a whitespace-separated list, deduplicated regardless of case. */
const tagList = (text: string): string[] => normalizeTagNames(text.split(/\s+/));

/**
 * The Bundle as a filter over the bookmarks alias `b`: its search compiled by the query grammar, `any_tags` needing
 * one of the names, `all_tags` every name and `excluded_tags` none, all ANDed; an empty part imposes nothing. Null
 * when the search does not parse, which makes the list empty like a bad `q`.
 */
// ponytail: the lists bind one parameter per name on top of the search's; a Bundle of dozens of tags beside a long q can pass SQLite's hundred.
export function bundleFilter(bundle: BundleRow): SearchFilter | null {
  const search = compileSearch(bundle.search);
  if (!search) return null;
  const conditions = [search.where];
  const params = [...search.params];
  const parts: [names: string[], clause: string, join: string][] = [
    [tagList(bundle.any_tags), TAG_EXISTS, " OR "],
    [tagList(bundle.all_tags), TAG_EXISTS, " AND "],
    [tagList(bundle.excluded_tags), `NOT ${TAG_EXISTS}`, " AND "],
  ];
  for (const [names, clause, join] of parts) {
    if (!names.length) continue;
    conditions.push(`(${names.map(() => clause).join(join)})`);
    params.push(...names);
  }
  return { where: conditions.join(" AND "), params };
}
