import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { type BundleInput, type BundleRow, EMPTY_BUNDLE, insertBundle } from "../db/bundles";
import { type FieldErrors, invalid, jsonBody, parseError } from "./serialize";

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

/** Creates the Bundle last, or at `order` when given; omitted text fields are empty. */
bundles.post("/bundles", async (c: Context<AppEnv>) => {
  const body = await jsonBody(c);
  if (!body) return parseError(c);
  const { fields, order, errors } = readFields(body);
  if (errors) return invalid(c, errors);
  const row = insertBundle(c.get("sql"), { ...EMPTY_BUNDLE, ...fields }, new Date().toISOString(), order);
  return c.json(bundleJson(row), 201);
});
