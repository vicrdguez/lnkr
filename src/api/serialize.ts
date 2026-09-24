import type { Context } from "hono";
import { type BookmarkRow, tagNamesOf } from "../db/bookmarks";
import type { TagRow } from "../db/tags";

/** linkding's bookmark document, keys in its order; the asset fields are fixed until those slices land. */
export const bookmarkJson = (sql: SqlStorage, row: BookmarkRow) => ({
  id: row.id,
  url: row.url,
  title: row.title,
  description: row.description,
  notes: row.notes,
  web_archive_snapshot_url: "",
  favicon_url: null,
  preview_image_url: null,
  is_archived: !!row.is_archived,
  unread: !!row.unread,
  shared: !!row.shared,
  tag_names: tagNamesOf(sql, row.id),
  date_added: row.date_added,
  date_modified: row.date_modified,
});

export const tagJson = (row: TagRow) => ({ id: row.id, name: row.name, date_added: row.date_added });

export const notFound = (c: Context) => c.json({ detail: "Not found." }, 404);

/** Django REST framework's validation shape: one list of messages per field. */
export type FieldErrors = Record<string, string[]>;
export const invalid = (c: Context, errors: FieldErrors) => c.json(errors, 400);

/** The JSON object body, or null when the body is not a JSON object. */
export async function jsonBody(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await c.req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
export const parseError = (c: Context) => c.json({ detail: "JSON parse error" }, 400);

/** The path parameter `name` as a number when it is all digits, else -1, which no row has. */
export function intParam(c: Context, name: string): number {
  const value = c.req.param(name) ?? "";
  return /^\d+$/.test(value) ? Number(value) : -1;
}
