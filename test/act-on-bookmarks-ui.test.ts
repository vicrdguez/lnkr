import { beforeEach, describe, expect, it } from "vitest";
import { api, apiToken, BASE, formPost, get, jsonPost, location, parseSse, select, setupTenant, type SseEvent } from "./helpers";

type Json = Record<string, unknown>;

let cookie: string;
let token: string;

beforeEach(async () => {
  cookie = await setupTenant();
  token = await apiToken(cookie);
});

/** Creates a bookmark through the API without touching the network and returns its id. */
async function create(url: string, fields: Json = {}): Promise<number> {
  const response = await api(token).post("/api/bookmarks/?disable_scraping", { url, ...fields });
  expect(response.status).toBe(201);
  return (await response.json<{ id: number }>()).id;
}

/** The background's bookmarks: One unread, Two, and Three archived, with ids 1, 2 and 3. */
async function threeBookmarks(): Promise<void> {
  expect(await create("https://example.com/1", { title: "One", unread: true })).toBe(1);
  expect(await create("https://example.com/2", { title: "Two" })).toBe(2);
  expect(await create("https://example.com/3", { title: "Three", is_archived: true })).toBe(3);
}

/** The bookmark as the API shows it. */
async function bookmark(id: number): Promise<Json> {
  const response = await api(token).get(`/api/bookmarks/${id}/`);
  expect(response.status).toBe(200);
  return response.json<Json>();
}

const status = async (id: number) => (await api(token).get(`/api/bookmarks/${id}/`)).status;

/** The HTML of `path` for the session, expecting 200. */
async function page(path: string): Promise<string> {
  const response = await get(path, { cookie });
  expect(response.status).toBe(200);
  return response.text();
}

const signalsOf = async (html: string) => JSON.parse((await select(html, "[data-signals]"))[0].attrs["data-signals"]);
const buttons = async (html: string, selector: string) => (await select(html, `${selector} button`)).map((b) => b.text);
const titles = async (html: string) => (await select(html, "#bookmark-list li a.title")).map((a) => a.text);

const DATASTAR = { "datastar-request": "true" };
/** The active list's page signals as the page declares them. */
const ACTIVE = { q: "", sort: "added_desc", unread: "", page: 1 };
const ARCHIVE = { ...ACTIVE, archived: true };

/** Posts `signals` the way Datastar does: a JSON body plus the header. */
const action = (path: string, signals: Json = ACTIVE, headers: Record<string, string> = DATASTAR) =>
  jsonPost(path, signals, { cookie, headers });

/** The action's events, expecting an SSE response. */
async function events(path: string, signals: Json = ACTIVE): Promise<SseEvent[]> {
  const response = await action(path, signals);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/event-stream");
  return parseSse(await response.text());
}

/** The elements of every `datastar-patch-elements` event, joined. */
const patched = (found: SseEvent[]) =>
  found.filter((event) => event.event === "datastar-patch-elements").map((event) => event.data.elements).join("\n");

/** The signals of each `datastar-patch-signals` event, in order. */
const patchedSignals = (found: SseEvent[]) =>
  found.filter((event) => event.event === "datastar-patch-signals").map((event) => JSON.parse(event.data.signals));

describe("Per-item actions", () => {
  beforeEach(threeBookmarks);

  it("renders buttons on the active list", async () => {
    const html = await page("/bookmarks");

    expect(await buttons(html, "#bookmark-1")).toEqual(["Archive", "Delete", "Mark read"]);
    expect(await buttons(html, "#bookmark-2")).toEqual(["Archive", "Delete"]);
    const remove = (await select(html, "#bookmark-1 button")).find((b) => b.text === "Delete");
    expect(remove?.attrs["data-on:click"]).toContain("confirm(");
    expect(await signalsOf(html)).toMatchObject({
      q: "",
      sort: "added_desc",
      unread: "",
      page: 1,
      selected: {},
      selectAcross: false,
      bulkTags: "",
    });
  });

  it("renders buttons on the archive", async () => {
    expect(await buttons(await page("/bookmarks/archived"), "#bookmark-3")).toEqual(["Unarchive", "Delete"]);
  });

  it("archives, patching the list and sidebar", async () => {
    const found = await events("/bookmarks/1/archive");

    const html = patched(found);
    expect(html).toContain('<ul id="bookmark-list"');
    expect(await titles(html)).toEqual(["Two"]);
    expect(html).toContain('<aside id="sidebar"');
    expect((await bookmark(1)).is_archived).toBe(true);
  });

  it("unarchives from the archive page", async () => {
    const found = await events("/bookmarks/3/unarchive", ARCHIVE);

    expect(await titles(patched(found))).toEqual([]);
    expect((await bookmark(3)).is_archived).toBe(false);
  });

  it("deletes the bookmark", async () => {
    const found = await events("/bookmarks/2/delete");

    expect(await titles(patched(found))).toEqual(["One"]);
    expect(await status(2)).toBe(404);
  });

  it("marks read", async () => {
    const found = await events("/bookmarks/1/read");

    const [item] = await select(patched(found), "#bookmark-1");
    expect(item.attrs.class).toBeUndefined();
    expect((await bookmark(1)).unread).toBe(false);
  });

  it("re-renders for the page's query", async () => {
    const found = await events("/bookmarks/1/archive", { ...ACTIVE, q: "Two" });

    expect(await titles(patched(found))).toEqual(["Two"]);
  });

  it("steps back a page after acting on the last item of the last page", async () => {
    // Thirty-one active bookmarks, newest first: page 2 holds only the oldest, One.
    for (let n = 4; n <= 32; n++) await create(`https://example.com/${n}`, { title: `B${n}` });

    const found = await events("/bookmarks/1/archive", { ...ACTIVE, page: 2 });

    expect(await titles(patched(found))).toHaveLength(30);
    expect(patchedSignals(found)).toContainEqual({ page: 1 });
  });

  it("answers 404 for an unknown id", async () => {
    expect((await action("/bookmarks/999/archive")).status).toBe(404);
  });
});

describe("Bulk bar", () => {
  beforeEach(threeBookmarks);

  it("renders with checkboxes", async () => {
    const html = await page("/bookmarks");

    expect(await select(html, "div#bulk-bar")).toHaveLength(1);
    expect(await buttons(html, "#bulk-bar")).toEqual(["Archive", "Delete", "Mark read", "Mark unread", "Tag", "Untag"]);
    const inputs = await select(html, "#bulk-bar input");
    expect(inputs.find((input) => input.attrs["data-bind"] === "bulkTags")?.attrs.type ?? "text").toBe("text");
    expect(inputs.find((input) => input.attrs["data-bind"] === "selectAcross")?.attrs.type).toBe("checkbox");
    const labels = await select(html, "#bulk-bar label");
    expect(labels.find((label) => label.text.includes("Select all"))?.attrs).toBeDefined();
    const [one] = await select(html, '#bookmark-1 input[type="checkbox"]');
    expect(one.attrs).toHaveProperty("data-bind:selected.b1");
    const [two] = await select(html, '#bookmark-2 input[type="checkbox"]');
    expect(two.attrs).toHaveProperty("data-bind:selected.b2");
  });

  it("offers Unarchive instead of Archive on the archive page", async () => {
    const found = await buttons(await page("/bookmarks/archived"), "#bulk-bar");

    expect(found).toContain("Unarchive");
    expect(found).not.toContain("Archive");
  });
});
