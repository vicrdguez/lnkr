import { beforeEach, describe, expect, it } from "vitest";
import { api, apiToken, BASE, formPost, get, location, select, setupTenant } from "./helpers";

type Json = Record<string, unknown>;

let cookie: string;
let token: string;

beforeEach(async () => {
  cookie = await setupTenant();
  token = await apiToken(cookie);
});

/** Creates a bookmark through the API without touching the network and returns its JSON. */
async function create(url: string, fields: Json = {}): Promise<Json> {
  const response = await api(token).post("/api/bookmarks/?disable_scraping", { url, ...fields });
  expect(response.status).toBe(201);
  return response.json<Json>();
}

/** The HTML of `path` for the session, expecting `status`. */
async function page(path: string, status = 200): Promise<string> {
  const response = await get(path, { cookie });
  expect(response.status).toBe(status);
  return response.text();
}

/** The value of each named form control: `value` for inputs, the content for textareas. */
async function fieldValues(html: string): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const input of await select(html, "main form input")) values[input.attrs.name] = input.attrs.value ?? "";
  for (const area of await select(html, "main form textarea")) values[area.attrs.name] = area.text;
  return values;
}

const signalsOf = async (html: string) => JSON.parse((await select(html, "main form"))[0].attrs["data-signals"]);

describe("New bookmark form", () => {
  it("renders empty", async () => {
    const html = await page("/bookmarks/new");

    const [form] = await select(html, "main form");
    expect(form.attrs.action).toBe("/bookmarks/new");
    expect(await fieldValues(html)).toEqual({ url: "", title: "", description: "", notes: "", tags: "", unread: "" });
    const [unread] = await select(html, 'form input[name="unread"]');
    expect(unread.attrs.type).toBe("checkbox");
    expect(unread.attrs.checked).toBeUndefined();
    expect(await select(html, 'input[name="auto_close"]')).toEqual([]);
    expect((await select(html, "script")).map((s) => s.attrs.src)).toContain("/static/datastar.js");
    expect((await get("/static/datastar.js")).status).toBe(200);
    expect(await signalsOf(html)).toEqual({ url: "", title: "", description: "", notes: "", tags: "", unread: false });
  });

  it("is prefilled from query parameters", async () => {
    const html = await page("/bookmarks/new?url=https://example.com/x&title=X&description=Desc&notes=N&tags=a+b&auto_close");

    const expected = { url: "https://example.com/x", title: "X", description: "Desc", notes: "N", tags: "a b" };
    expect(await fieldValues(html)).toMatchObject(expected);
    const [autoClose] = await select(html, 'form input[name="auto_close"]');
    expect(autoClose.attrs.type).toBe("hidden");
    expect(await signalsOf(html)).toEqual({ ...expected, unread: false });
  });
});

describe("Saving a new bookmark", () => {
  const listed = async () => (await api(token).get("/api/bookmarks/")).json<{ count: number; results: Json[] }>();

  it("creates the bookmark and redirects to the list", async () => {
    const fields = { url: "https://example.com/x", title: "X", description: "Desc", notes: "N", tags: "a b", unread: "on" };

    const response = await formPost("/bookmarks/new", fields, { cookie });

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/bookmarks`);
    const { count, results } = await listed();
    expect(count).toBe(1);
    expect(results[0]).toMatchObject({
      url: "https://example.com/x",
      title: "X",
      description: "Desc",
      notes: "N",
      tag_names: ["a", "b"],
      unread: true,
    });
  });

  it("ends on the close page with auto_close", async () => {
    const response = await formPost("/bookmarks/new", { url: "https://example.com/x", auto_close: "1" }, { cookie });

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/bookmarks/close`);
    const html = await page("/bookmarks/close");
    expect(html).toContain("You can now close this window");
    expect(html).toContain("window.close()");
  });

  it("updates the bookmark that already has the URL", async () => {
    await create("https://example.com/x", { title: "Old", tag_names: ["old"] });

    const response = await formPost("/bookmarks/new", { url: "https://example.com/x", title: "New", tags: "new" }, { cookie });

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/bookmarks`);
    const { count, results } = await listed();
    expect(count).toBe(1);
    expect(results[0]).toMatchObject({ title: "New", tag_names: ["new"] });
  });

  it.each(["", "nope", "ftp://x.y/"])("refuses the URL %j", async (url) => {
    const response = await formPost("/bookmarks/new", { url, title: "T" }, { cookie });

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain("Enter a valid URL");
    expect(await fieldValues(html)).toMatchObject({ url, title: "T" });
    expect((await listed()).count).toBe(0);
  });
});
