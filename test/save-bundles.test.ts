import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiToken, formPost, get, jsonPost, location, parseSse, select, setupInstance, type SseEvent } from "./helpers";

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
  cookie = await setupInstance();
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

  it("puts a new bundle last", async () => {
    await createBundle({ name: "A" });
    await createBundle({ name: "B" });

    expect((await createBundle({ name: "Z" })).order).toBe(2);
  });

  it("requires a name", async () => {
    const response = await api(token).post("/api/bundles/", { search: "x" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ name: ["This field is required."] });
  });

  it("lists, gets, puts, patches and deletes", async () => {
    await createBundle({ name: "Py", any_tags: "python" });

    const list = await api(token).get("/api/bundles/");
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ count: 1, results: [{ name: "Py" }] });

    const put = await api(token).put("/api/bundles/1/", { name: "Py2" });
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ name: "Py2", any_tags: "" });

    const patch = await api(token).patch("/api/bundles/1/", { any_tags: "python" });
    expect(patch.status).toBe(200);
    expect(await patch.json()).toMatchObject({ name: "Py2", any_tags: "python" });

    expect((await api(token).get("/api/bundles/1/")).status).toBe(200);
    expect((await api(token).del("/api/bundles/1/")).status).toBe(204);
    expect((await api(token).get("/api/bundles/1/")).status).toBe(404);
  });

  it("needs a token", async () => {
    expect((await api().get("/api/bundles/")).status).toBe(401);
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
    ["(docs", "", "", "", ""],
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

  it("finds nothing when a bundle needs too many parameters", async () => {
    const names = Array.from({ length: 100 }, (_, n) => `t${n}`).join(" ");
    const { id } = await createBundle({ name: "Wide", any_tags: names });

    const response = await api(token).get(`/api/bookmarks/?bundle=${id}`);

    expect(response.status).toBe(200);
    expect((await response.json<{ count: number }>()).count).toBe(0);
  });

  it("refuses an unknown bundle on the bookmarks API", async () => {
    const response = await api(token).get("/api/bookmarks/?bundle=999");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ bundle: ["Invalid bundle."] });
  });
});

/** The HTML of `path` for the session, expecting `status`. */
async function page(path: string, status = 200): Promise<string> {
  const response = await get(path, { cookie });
  expect(response.status).toBe(status);
  return response.text();
}

/** The Bundle names `/bundles` lists, in order. */
const listed = async () => (await select(await page("/bundles"), "#bundle-list li a.name")).map((a) => a.text);

/** The bundles API's list, expecting 200. */
async function apiList(): Promise<{ count: number; results: Json[] }> {
  const response = await api(token).get("/api/bundles/");
  expect(response.status).toBe(200);
  return response.json();
}

describe("Bundle pages", () => {
  const post = (path: string, fields: Record<string, string>) => formPost(path, fields, { cookie });

  it("creates a bundle", async () => {
    const response = await post("/bundles/new", {
      name: "Py web",
      search: "docs",
      any_tags: "python",
      all_tags: "web",
      excluded_tags: "rust",
    });

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/bundles");
    expect(await listed()).toEqual(["Py web"]);
    const { count, results } = await apiList();
    expect(count).toBe(1);
    expect(results[0]).toMatchObject({ name: "Py web", search: "docs", any_tags: "python", all_tags: "web", excluded_tags: "rust", order: 0 });
  });

  it("requires a name", async () => {
    const response = await post("/bundles/new", { name: "", search: "docs" });

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(await select(html, 'form input[name="name"]')).toHaveLength(1);
    expect(await select(html, "p.error")).toHaveLength(1);
    expect((await apiList()).count).toBe(0);
  });

  it("edits a bundle", async () => {
    vi.setSystemTime(new Date("2026-09-20T10:00:00.000Z"));
    await createBundle({ name: "Old" });
    const form = await page("/bundles/1/edit");
    expect((await select(form, 'form input[name="name"]'))[0].attrs.value).toBe("Old");

    vi.setSystemTime(new Date("2026-09-20T10:05:00.000Z"));
    const response = await post("/bundles/1/edit", { name: "New", any_tags: "rust" });

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/bundles");
    const body = await (await api(token).get("/api/bundles/1/")).json<Json>();
    expect(body).toMatchObject({ name: "New", any_tags: "rust", date_modified: "2026-09-20T10:05:00.000Z" });
    expect(body.date_created).toBe("2026-09-20T10:00:00.000Z");
  });

  it("deletes a bundle", async () => {
    await createBundle({ name: "Gone" });

    const response = await post("/bundles/1/delete", {});

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/bundles");
    expect((await api(token).get("/api/bundles/1/")).status).toBe(404);
  });

  it("reorders with up and down", async () => {
    const first = await createBundle({ name: "First" });
    await createBundle({ name: "Second" });
    const third = await createBundle({ name: "Third" });

    expect((await post(`/bundles/${third.id}/up`, {})).status).toBe(302);
    expect(await listed()).toEqual(["First", "Third", "Second"]);

    expect((await post(`/bundles/${first.id}/down`, {})).status).toBe(302);
    expect(await listed()).toEqual(["Third", "First", "Second"]);
    const { results } = await apiList();
    expect(results.map((row) => [row.name, row.order])).toEqual([["Third", 0], ["First", 1], ["Second", 2]]);
  });
});

const titles = async (html: string) => (await select(html, "#bookmark-list li a.title")).map((a) => a.text);
const signalsOf = async (html: string) => JSON.parse((await select(html, "[data-signals]"))[0].attrs["data-signals"]);
/** The `href` of the first link whose text is `text`, or undefined when there is none. */
const link = async (html: string, text: string) => (await select(html, "a")).find((a) => a.text === text)?.attrs.href;

describe("Sidebar and list filtering", () => {
  beforeEach(async () => {
    await createBundle({ name: "Py", any_tags: "python" });
    await createBundle({ name: "Docs", search: "docs" });
  });

  it("lists bundles in order in the sidebar", async () => {
    const html = await page("/bookmarks");

    expect((await select(html, "#sidebar #bundles h2"))[0].text).toBe("Bundles");
    const links = await select(html, "#sidebar #bundles li a");
    expect(links.map((a) => [a.text, a.attrs.href])).toEqual([
      ["Py", "/bookmarks?bundle=1"],
      ["Docs", "/bookmarks?bundle=2"],
    ]);
  });

  it("marks the active bundle and offers Clear", async () => {
    const html = await page("/bookmarks?bundle=1&q=web");

    const links = await select(html, "#sidebar #bundles li a");
    expect(links.find((a) => a.text === "Py")?.attrs.class).toBe("active");
    expect(links.find((a) => a.text === "Docs")?.attrs.class).toBeUndefined();
    expect((await select(html, "#bundles a")).find((a) => a.text === "Clear")?.attrs.href).toBe("/bookmarks?q=web");
    expect(await signalsOf(html)).toMatchObject({ bundle: "1" });
  });

  it("narrows the list", async () => {
    expect(await titles(await page("/bookmarks?bundle=1"))).toEqual(["Django docs", "B", "A"]);
  });

  it("combines with q and the unread filter", async () => {
    expect((await api(token).patch("/api/bookmarks/1/", { unread: true })).status).toBe(200);

    // The scenario writes `q=web`; under the accepted grammar a bare term never matches a Tag, so the tag query stands in.
    expect(await titles(await page("/bookmarks?bundle=1&q=%23web&unread=yes"))).toEqual(["A"]);
  });

  it("reflects the bundle in the tag sidebar", async () => {
    const tags = (await select(await page("/bookmarks?bundle=1"), "#sidebar > ul li")).map((li) => li.text);

    expect(tags).toEqual(["docs 1", "python 3", "web 2"]);
  });

  it("keeps the bundle on the archive", async () => {
    expect((await api(token).post("/api/bookmarks/2/archive/")).status).toBe(204);

    const html = await page("/bookmarks/archived?bundle=1");

    expect(await titles(html)).toEqual(["B"]);
    expect(await link(html, "Py")).toBe("/bookmarks/archived?bundle=1");
  });

  it("ignores an unknown bundle", async () => {
    const html = await page("/bookmarks?bundle=999");

    expect(await titles(html)).toEqual(["Django docs", "C", "B", "A"]);
    expect((await select(html, "#bundles a")).map((a) => a.text)).toEqual(["Py", "Docs"]);
    expect(await signalsOf(html)).toMatchObject({ bundle: "" });
    expect(await link(html, "Next")).toBeUndefined();
  });

  it("keeps the bundle in page links", async () => {
    for (let n = 1; n <= 30; n++) {
      const response = await api(token).post("/api/bookmarks/?disable_scraping", { url: `https://p${n}.test/`, tag_names: ["python"] });
      expect(response.status).toBe(201);
    }

    expect(await link(await page("/bookmarks?bundle=1"), "Next")).toBe("/bookmarks?bundle=1&page=2");
  });
});

describe("Actions keep the applied bundle", () => {
  const DATASTAR = { "datastar-request": "true" };
  const SIGNALS = { q: "", sort: "added_desc", unread: "", page: 1, bundle: "1" };

  /** The action's patched elements, expecting an SSE response. */
  async function patched(path: string, signals: Json): Promise<string> {
    const response = await jsonPost(path, signals, { cookie, headers: DATASTAR });
    expect(response.status).toBe(200);
    const events: SseEvent[] = parseSse(await response.text());
    return events.filter((event) => event.event === "datastar-patch-elements").map((event) => event.data.elements).join("\n");
  }

  const archived = async (id: number) => (await (await api(token).get(`/api/bookmarks/${id}/`)).json<Json>()).is_archived;

  beforeEach(async () => {
    await createBundle({ name: "Py", any_tags: "python" });
  });

  it("re-renders the list with the bundle applied after an item action", async () => {
    const html = await patched("/bookmarks/1/archive", SIGNALS);

    expect(html).toContain('<ul id="bookmark-list"');
    expect(await titles(html)).toEqual(["Django docs", "B"]);
  });

  it("applies select across to the bundle", async () => {
    await patched("/bookmarks/bulk", { ...SIGNALS, action: "archive", selectAcross: true, selected: {} });

    for (const id of [1, 2, 4]) expect(await archived(id)).toBe(true);
    expect(await archived(3)).toBe(false);
  });
});
