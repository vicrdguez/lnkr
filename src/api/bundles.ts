import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import {
  type BundleInput,
  type BundleRow,
  deleteBundle,
  EMPTY_BUNDLE,
  getBundle,
  insertBundle,
  listBundles,
  updateBundle,
} from "../db/bundles";
import { pageParams, paginate } from "./envelope";
import { type FieldErrors, intParam, invalid, jsonBody, notFound, parseError } from "./serialize";

/** linkding's bundle document, keys in its order; `order` is the sidebar position. */
export const bundleJson = (row: BundleRow) => ({
  id: row.id,
  name: row.name,
  search: row.search,
  any_tags: row.any_tags,
  all_tags: row.all_tags,
  excluded_tags: row.excluded_tags,
  order: row.sort_order,
  date_created: row.date_created,
  date_modified: row.date_modified,
});

const TEXT_FIELDS = ["name", "search", "any_tags", "all_tags", "excluded_tags"] as const;

type FieldsResult =
  | { fields: Partial<BundleInput>; order?: number; errors?: undefined }
  | { errors: FieldErrors; fields?: undefined; order?: undefined };

/** Validates the fields present in `body`; `name` is required unless `nameOptional`, and never blank. */
function readFields(body: Record<string, unknown>, nameOptional = false): FieldsResult {
  const fields: Partial<BundleInput> = {};
  const errors: FieldErrors = {};
  for (const key of TEXT_FIELDS) {
    if (body[key] === undefined) continue;
    if (typeof body[key] === "string") fields[key] = body[key];
    else errors[key] = ["Invalid value."];
  }
  let order: number | undefined;
  if (body.order !== undefined) {
    if (Number.isInteger(body.order)) order = body.order as number;
    else errors.order = ["Invalid value."];
  }
  if (fields.name !== undefined) {
    fields.name = fields.name.trim();
    if (!fields.name) errors.name = ["This field may not be blank."];
  } else if (!nameOptional && !errors.name) errors.name = ["This field is required."];
  return Object.keys(errors).length ? { errors } : { fields, order };
}

export const bundles = new Hono<AppEnv>();

bundles.get("/bundles", (c) => {
  const page = pageParams(c);
  const rows = listBundles(c.get("sql"));
  // ponytail: pages in memory; a Tenant holds a handful of Bundles.
  return c.json(paginate(c, page, rows.length, rows.slice(page.offset, page.offset + page.limit).map(bundleJson)));
});

/** Creates the Bundle last, or at `order` when given; omitted text fields are empty. */
bundles.post("/bundles", async (c: Context<AppEnv>) => {
  const body = await jsonBody(c);
  if (!body) return parseError(c);
  const { fields, order, errors } = readFields(body);
  if (errors) return invalid(c, errors);
  const row = insertBundle(c.get("sql"), { ...EMPTY_BUNDLE, ...fields }, new Date().toISOString(), order);
  return c.json(bundleJson(row), 201);
});

bundles.get("/bundles/:id", (c) => {
  const row = getBundle(c.get("sql"), intParam(c, "id"));
  return row ? c.json(bundleJson(row)) : notFound(c);
});

/** PUT replaces every text field, emptying omitted ones; PATCH keeps what the body omits. `order` moves only when given. */
async function update(c: Context<AppEnv>, patch: boolean) {
  const body = await jsonBody(c);
  if (!body) return parseError(c);
  const sql = c.get("sql");
  const existing = getBundle(sql, intParam(c, "id"));
  if (!existing) return notFound(c);
  const { fields, order, errors } = readFields(body, patch);
  if (errors) return invalid(c, errors);
  const input = patch ? fields : { ...EMPTY_BUNDLE, ...fields };
  const row = updateBundle(sql, existing.id, input, new Date().toISOString(), order);
  return c.json(bundleJson(row));
}
bundles.put("/bundles/:id", (c) => update(c, false));
bundles.patch("/bundles/:id", (c) => update(c, true));

bundles.delete("/bundles/:id", (c) =>
  deleteBundle(c.get("sql"), intParam(c, "id")) ? c.body(null, 204) : notFound(c),
);
