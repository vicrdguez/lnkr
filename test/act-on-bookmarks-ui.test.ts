import { beforeEach, describe, expect, it } from "vitest";
import { api, apiToken, BASE, formPost, get, jsonPost, location, parseSse, select, setupInstance, type SseEvent } from "./helpers";

type Json = Record<string, unknown>;

let cookie: string;
let token: string;

beforeEach(async () => {
  cookie = await setupInstance();
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

    expect(await buttons(html, "#bookmark-1")).toEqual(["Archive", "Delete", "Mark read", "Snapshot"]);
    expect(await buttons(html, "#bookmark-2")).toEqual(["Archive", "Delete", "Snapshot"]);
    const del = (await select(html, "#bookmark-1 button")).find((b) => b.text === "Delete");
    expect(del?.attrs["data-on:click"]).toContain("confirm(");
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
    expect(await buttons(await page("/bookmarks/archived"), "#bookmark-3")).toEqual(["Unarchive", "Delete", "Snapshot"]);
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
    expect(inputs.find((input) => input.attrs["data-bind"] === "bulkTags")?.attrs.type).toBe("text");
    expect(inputs.find((input) => input.attrs["data-bind"] === "selectAcross")?.attrs.type).toBe("checkbox");
    const labels = await select(html, "#bulk-bar label");
    expect(labels.map((label) => label.text.trim())).toContain("Select all");
    // Select across shows only while the whole page is selected and disarms itself the moment it no longer is.
    const across = labels.find((label) => label.text.includes("Select across"));
    expect(across?.attrs["data-show"]).toBe("$selected.b2 && $selected.b1");
    expect(across?.attrs["data-effect"]).toBe("($selected.b2 && $selected.b1) || ($selectAcross = false)");
    const checkboxes = await select(html, '#bulk-bar label input[type="checkbox"]');
    expect(checkboxes.map((box) => box.attrs["data-on:change"] ?? box.attrs["data-bind"])).toEqual([
      expect.stringContaining("$selected = {b2: evt.target.checked, b1: evt.target.checked}"),
      "selectAcross",
    ]);
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

describe("Bulk actions", () => {
  beforeEach(threeBookmarks);

  /** Posts a bulk action with the active page's signals unless `signals` says otherwise. */
  const bulk = (signals: Json) =>
    events("/bookmarks/bulk", { ...ACTIVE, selected: {}, selectAcross: false, bulkTags: "", ...signals });
  const tagged = async (id: number, names: string[]) =>
    expect((await api(token).patch(`/api/bookmarks/${id}/`, { tag_names: names })).status).toBe(200);

  it.each<[string, Json | number, Json | number]>([
    ["archive", { is_archived: true }, { is_archived: false }],
    ["delete", 404, 200],
    ["read", { unread: false }, { unread: false }],
    ["unread", { unread: true }, { unread: false }],
  ])("%s applies to the selected ids", async (action, one, two) => {
    await bulk({ action, selected: { b1: true, b2: false } });

    for (const [id, expected] of [[1, one], [2, two]] as const) {
      if (typeof expected === "number") expect(await status(id)).toBe(expected);
      else expect(await bookmark(id)).toMatchObject(expected);
    }
  });

  it("unarchives from the archive page", async () => {
    await bulk({ ...ARCHIVE, action: "unarchive", selected: { b3: true } });

    expect((await bookmark(3)).is_archived).toBe(false);
  });

  it("tag adds names", async () => {
    await tagged(1, ["keep"]);

    await bulk({ action: "tag", bulkTags: "alpha Beta", selected: { b1: true, b2: true } });

    expect((await bookmark(1)).tag_names).toEqual(["alpha", "Beta", "keep"]);
    expect((await bookmark(2)).tag_names).toEqual(["alpha", "Beta"]);
  });

  it("untag removes names", async () => {
    await tagged(1, ["alpha", "keep"]);
    await tagged(2, ["alpha", "keep"]);

    await bulk({ action: "untag", bulkTags: "ALPHA", selected: { b1: true, b2: true } });

    expect((await bookmark(1)).tag_names).toEqual(["keep"]);
    expect((await bookmark(2)).tag_names).toEqual(["keep"]);
  });

  it("resets the selection", async () => {
    const found = await bulk({ action: "read", selected: { b1: true }, bulkTags: "x" });

    expect(patchedSignals(found)).toContainEqual({ selected: {}, selectAcross: false, bulkTags: "" });
    const html = patched(found);
    for (const opening of ['<ul id="bookmark-list"', '<aside id="sidebar"', '<div id="bulk-bar"']) {
      expect(html).toContain(opening);
    }
  });

  it("select across applies to the filtered result only", async () => {
    await create("https://example.com/4", { tag_names: ["python"] });
    await create("https://example.com/5", { tag_names: ["python"] });
    await create("https://example.com/6", { tag_names: ["rust"] });

    await bulk({ action: "archive", selectAcross: true, q: "#python" });

    for (const id of [4, 5]) expect((await bookmark(id)).is_archived).toBe(true);
    for (const id of [1, 2, 6]) expect((await bookmark(id)).is_archived).toBe(false);
  });

  it("select across respects the unread filter and the page kind", async () => {
    await bulk({ action: "delete", selectAcross: true, unread: "yes" });

    expect(await status(1)).toBe(404);
    expect(await status(2)).toBe(200);
    expect(await status(3)).toBe(200);
  });

  it("does nothing with nothing selected", async () => {
    await bulk({ action: "delete" });

    for (const id of [1, 2, 3]) expect(await status(id)).toBe(200);
  });

  it("answers 400 for an unknown action", async () => {
    expect((await action("/bookmarks/bulk", { ...ACTIVE, action: "explode", selected: {} })).status).toBe(400);
  });

  it("takes more than a hundred selected ids", async () => {
    const ids = [1, 2];
    for (let n = 4; n <= 121; n++) ids.push(await create(`https://example.com/${n}`, { unread: true }));

    await bulk({ action: "read", selected: Object.fromEntries(ids.map((id) => [`b${id}`, true])) });

    const unread = await (await api(token).get("/api/bookmarks/?q=%21unread")).json<{ count: number }>();
    expect(ids).toHaveLength(120);
    expect(unread.count).toBe(0);
    expect((await bookmark(121)).unread).toBe(false);
  });
});

describe("Request requirements", () => {
  beforeEach(threeBookmarks);

  it("needs the Datastar header", async () => {
    const response = await formPost("/bookmarks/1/archive", { page: "1" }, { cookie });

    expect(response.status).toBe(400);
    expect((await bookmark(1)).is_archived).toBe(false);
  });

  it("needs a JSON body", async () => {
    const response = await formPost("/bookmarks/1/archive", { page: "1" }, { cookie, headers: DATASTAR });

    expect(response.status).toBe(400);
    expect((await bookmark(1)).is_archived).toBe(false);
  });

  it("needs a session", async () => {
    const response = await jsonPost("/bookmarks/1/archive", ACTIVE, { headers: DATASTAR });

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/login?next=%2Fbookmarks%2F1%2Farchive`);
  });
});
