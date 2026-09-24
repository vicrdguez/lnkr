import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import {
  type BundleInput,
  deleteBundle,
  EMPTY_BUNDLE,
  getBundle,
  insertBundle,
  listBundles,
  moveBundle,
  updateBundle,
} from "../db/bundles";
import { BundleForm, BundleList } from "../views/bundles";
import { formFields } from "./form";

/** The posted form, its name trimmed; the tag lists stay as typed. */
async function readForm(c: Context<AppEnv>): Promise<BundleInput> {
  const fields = await formFields(c, "name", "search", "any_tags", "all_tags", "excluded_tags");
  return { ...fields, name: fields.name.trim() };
}

const formPage = (c: Context<AppEnv>, title: string, values: BundleInput, error?: string) => (
  <BundleForm user={c.get("user")} title={title} action={c.req.path} values={values} error={error} />
);

export const bundlePages = new Hono<AppEnv>();

bundlePages.get("/bundles", (c) => c.html(<BundleList user={c.get("user")} bundles={listBundles(c.get("sql"))} />));

bundlePages.get("/bundles/new", (c) => c.html(formPage(c, "New bundle", EMPTY_BUNDLE)));

/** Creates the Bundle last and lands back on the list. */
bundlePages.post("/bundles/new", async (c) => {
  const values = await readForm(c);
  if (!values.name) return c.html(formPage(c, "New bundle", values, "A bundle needs a name."), 400);
  insertBundle(c.get("sql"), values, new Date().toISOString());
  return c.redirect("/bundles");
});

const ID = "/bundles/:id{[0-9]+}";
const idOf = (c: Context<AppEnv>) => Number(c.req.param("id"));

bundlePages.get(`${ID}/edit`, (c) => {
  const row = getBundle(c.get("sql"), idOf(c));
  return row ? c.html(formPage(c, "Edit bundle", row)) : c.notFound();
});

/** Replaces the Bundle's text fields and lands back on the list. */
bundlePages.post(`${ID}/edit`, async (c) => {
  const values = await readForm(c);
  const sql = c.get("sql");
  if (!getBundle(sql, idOf(c))) return c.notFound();
  if (!values.name) return c.html(formPage(c, "Edit bundle", values, "A bundle needs a name."), 400);
  updateBundle(sql, idOf(c), values, new Date().toISOString());
  return c.redirect("/bundles");
});

bundlePages.post(`${ID}/delete`, (c) => (deleteBundle(c.get("sql"), idOf(c)) ? c.redirect("/bundles") : c.notFound()));

bundlePages.post(`${ID}/:direction{up|down}`, (c) =>
  moveBundle(c.get("sql"), idOf(c), c.req.param("direction") as "up" | "down") ? c.redirect("/bundles") : c.notFound(),
);
