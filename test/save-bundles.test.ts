import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiToken, formPost, get, jsonPost, location, parseSse, select, setupTenant, type SseEvent } from "./helpers";

type Json = Record<string, unknown>;

let cookie: string;
let token: string;

/** The background's bookmarks, ids 1 to 4 in this order, so newest first reads Django docs, C, B, A. */
const BOOKMARKS = [
  ["https://a.test/", "A", ["python", "web"]],
  ["https://b.test/", "B", ["python"]],
  ["https://c.test/", "C", ["rust"]],
  ["https://d.test/", "Django docs", ["python", "web", "docs"]],
] as const;

beforeEach(async () => {
  cookie = await setupTenant();
  token = await apiToken(cookie);
  for (const [url, title, tag_names] of BOOKMARKS) {
    const response = await api(token).post("/api/bookmarks/?disable_scraping", { url, title, tag_names });
    expect(response.status).toBe(201);
  }
});

/** Creates a Bundle through the API and returns its document. */
async function createBundle(fields: Json): Promise<Json> {
  const response = await api(token).post("/api/bundles/", fields);
  expect(response.status).toBe(201);
  return response.json<Json>();
}

const BUNDLE_KEYS = ["id", "name", "search", "any_tags", "all_tags", "excluded_tags", "order", "date_created", "date_modified"];

describe("Bundles API", () => {
  it("creates through the API", async () => {
    const response = await api(token).post("/api/bundles/", { name: "Py", any_tags: "python" });

    expect(response.status).toBe(201);
    const body = await response.json<Json>();
    expect(Object.keys(body)).toEqual(BUNDLE_KEYS);
    expect(body).toMatchObject({ name: "Py", search: "", any_tags: "python", all_tags: "", excluded_tags: "", order: 0 });
  });
});

/** The hosts of the bookmarks the API lists for `path`, in order. */
async function hosts(path: string): Promise<string[]> {
  const response = await api(token).get(path);
  expect(response.status).toBe(200);
  const { results } = await response.json<{ results: { url: string }[] }>();
  return results.map((row) => new URL(row.url).host);
}

describe("Bundle composition", () => {
  it.each<[search: string, any: string, all: string, excluded: string, results: string]>([
    ["", "", "", "", "d.test, c.test, b.test, a.test"],
    ["docs", "", "", "", "d.test"],
    ["", "python", "", "", "d.test, b.test, a.test"],
    ["", "python rust", "", "", "d.test, c.test, b.test, a.test"],
    ["", "", "python web", "", "d.test, a.test"],
    ["", "", "", "web", "c.test, b.test"],
    ["", "PYTHON", "", "DOCS", "b.test, a.test"],
    ["not docs", "python", "web", "", "a.test"],
    ["( docs", "", "", "", ""],
  ])("search %j, any %j, all %j, excluded %j restricts the result", async (search, any_tags, all_tags, excluded_tags, results) => {
    const { id } = await createBundle({ name: "B", search, any_tags, all_tags, excluded_tags });

    expect(await hosts(`/api/bookmarks/?bundle=${id}`)).toEqual(results ? results.split(", ") : []);
  });

  it("requires both the bundle and q", async () => {
    await createBundle({ name: "Py", any_tags: "python" });

    const rust = await api(token).get("/api/bookmarks/?bundle=1&q=rust");
    expect((await rust.json<{ count: number }>()).count).toBe(0);
    expect(await hosts("/api/bookmarks/?bundle=1&q=%23web")).toEqual(["d.test", "a.test"]);
  });

  it("refuses an unknown bundle on the bookmarks API", async () => {
    const response = await api(token).get("/api/bookmarks/?bundle=999");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ bundle: ["Invalid bundle."] });
  });
});
